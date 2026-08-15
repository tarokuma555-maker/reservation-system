/**
 * レシートOCRと、その結果から仕訳候補を組み立てる処理。
 *
 * 合いことば（APIキー）があれば Cloud Vision API を呼び、
 * なければ同梱のサンプルレシート文面を返す（お試しモード）。
 * どちらの場合も、後段の「文字列 → 日付・金額・取引先・登録番号」の解析は同じコードを通る。
 * つまり解析ロジック自体はお試しでも実物でも同一で、テストの対象にできる。
 *
 * 合いことばはLINEやカレンダーと同じく、画面から入れてDBに暗号化して置く。
 * 環境変数だけにすると、入れ替えのたびに再デプロイが要るため。
 */
import { cache } from "react";
import { getCredentials } from "./connections";

export type VisionCredentials = { apiKey: string };

function credentialsFromEnv(): VisionCredentials | null {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  return apiKey ? { apiKey } : null;
}

export const getVisionCredentials = cache(async function getVisionCredentials(): Promise<VisionCredentials | null> {
  const { credentials } = await getCredentials<VisionCredentials>("google_vision", credentialsFromEnv);
  return credentials;
});

export async function isVisionLive(): Promise<boolean> {
  const c = await getVisionCredentials();
  return Boolean(c?.apiKey);
}

export async function ocrMode(): Promise<"live" | "mock"> {
  return (await isVisionLive()) ? "live" : "mock";
}

export function getVisionConnection() {
  return import("./connections").then((m) =>
    m.getConnection("google_vision", () => Boolean(process.env.GOOGLE_VISION_API_KEY))
  );
}

/**
 * 合いことばが本物か、その場で確かめる。
 * 1×1の画像を送って、鍵として通るかどうかだけを見る。
 */
export async function testVisionCredentials(
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1×1の透明なPNG。文字は入っていないので、結果は空で構わない。
  const TINY_PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  try {
    const res = await fetch(`${VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { content: TINY_PNG }, features: [{ type: "TEXT_DETECTION" }] }],
      }),
    });

    if (res.ok) return { ok: true };

    const body = await res.text();
    if (res.status === 400 && body.includes("API key not valid")) {
      return { ok: false, error: "その合いことばは使えないようです。写し間違いがないかご確認ください。" };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          "この合いことばでは読み取りを呼べませんでした。Google側で「Cloud Vision API」を有効にしたか、鍵の制限を確認してください。",
      };
    }
    return { ok: false, error: `Googleからの返事: ${res.status} ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `つながりませんでした: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

/** 画像（base64）から文字列を取り出す */
export async function runOcr(imageBase64: string, sampleKey?: string): Promise<string> {
  const credentials = await getVisionCredentials();
  if (!credentials?.apiKey) return sampleReceiptText(sampleKey);

  const res = await fetch(`${VISION_URL}?key=${encodeURIComponent(credentials.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["ja"] },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision API ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as {
    responses: { fullTextAnnotation?: { text: string } }[];
  };
  return json.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

/* ---------------- レシート文面の解析 ---------------- */

export type ParsedReceipt = {
  vendorName: string;
  transactionDate: string | null; // YYYY-MM-DD
  totalAmount: number | null; // 税込
  registrationNumber: string | null;
  taxRate: number;
  hasQualifiedInvoice: boolean;
  rawText: string;
};

const DATE_PATTERNS: { re: RegExp; build: (m: RegExpMatchArray) => string }[] = [
  {
    re: /(\d{4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/,
    build: (m) => `${m[1]}-${pad(m[2])}-${pad(m[3])}`,
  },
  {
    re: /令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
    build: (m) => `${2018 + Number(m[1])}-${pad(m[2])}-${pad(m[3])}`,
  },
];

/** 合計金額として拾う見出し。下にあるものほど優先度が高い。 */
const TOTAL_KEYWORDS = ["小計", "計", "合計", "税込合計", "お買上計", "ご請求額", "合計金額"];

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 取引年月日
  let transactionDate: string | null = null;
  for (const line of lines) {
    for (const p of DATE_PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        transactionDate = p.build(m);
        break;
      }
    }
    if (transactionDate) break;
  }

  // 登録番号（相手が適格請求書発行事業者かどうかの判断材料）
  const regMatch = text.match(/T\s?(\d{13})/);
  const registrationNumber = regMatch ? `T${regMatch[1]}` : null;

  // 合計金額: 見出しを含む行の数字を拾い、優先度の高い見出しを採用する
  let totalAmount: number | null = null;
  let bestPriority = -1;
  for (const line of lines) {
    const priority = TOTAL_KEYWORDS.reduce(
      (acc, kw, i) => (line.includes(kw) ? Math.max(acc, i) : acc),
      -1
    );
    if (priority < 0) continue;
    const amount = extractAmount(line);
    if (amount !== null && priority >= bestPriority) {
      totalAmount = amount;
      bestPriority = priority;
    }
  }
  // 見出しが見つからないときは、いちばん大きい金額を合計とみなす
  if (totalAmount === null) {
    const amounts = lines.map(extractAmount).filter((n): n is number => n !== null);
    totalAmount = amounts.length ? Math.max(...amounts) : null;
  }

  // 取引先: 登録番号や日付・金額を含まない最初の行を採用する
  const vendorName =
    lines.find(
      (l) =>
        !/T\s?\d{13}/.test(l) &&
        !DATE_PATTERNS.some((p) => p.re.test(l)) &&
        extractAmount(l) === null &&
        l.length >= 2
    ) ?? "不明";

  const taxRate = /軽減|※|\*8%|8%/.test(text) ? 8 : 10;

  return {
    vendorName: vendorName.replace(/^[（(【\[]|[)）】\]]$/g, ""),
    transactionDate,
    totalAmount,
    registrationNumber,
    taxRate,
    hasQualifiedInvoice: Boolean(registrationNumber),
    rawText: text,
  };
}

function extractAmount(line: string): number | null {
  const m = line.match(/[¥￥]?\s*([0-9][0-9,]{1,9})\s*円?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pad(v: string): string {
  return v.padStart(2, "0");
}

/* ---------------- 勘定科目の推定 ---------------- */

const ACCOUNT_RULES: { keywords: string[]; code: string }[] = [
  { keywords: ["ドラッグ", "薬局", "洗剤", "ホームセンター", "カインズ", "ダイソー", "掃除", "用品"], code: "5110" },
  { keywords: ["ガソリン", "ENEOS", "出光", "コスモ", "給油"], code: "5140" },
  { keywords: ["駐車", "パーキング", "コインパ", "タイムズ"], code: "5150" },
  { keywords: ["JR", "私鉄", "交通", "タクシー", "バス", "PASMO", "Suica", "きっぷ"], code: "5120" },
  { keywords: ["ドコモ", "au", "ソフトバンク", "携帯", "通信", "インターネット", "プロバイダ"], code: "5160" },
  { keywords: ["電気", "ガス", "水道", "東京電力"], code: "5170" },
  { keywords: ["家賃", "賃料", "管理費"], code: "5180" },
  { keywords: ["広告", "チラシ", "印刷", "名刺"], code: "5190" },
  { keywords: ["研修", "セミナー", "講座", "受講", "講習", "書籍", "書店", "協会"], code: "5200" },
  { keywords: ["振込手数料", "手数料"], code: "5210" },
];

export function suggestAccountCode(parsed: ParsedReceipt): string {
  const haystack = `${parsed.vendorName} ${parsed.rawText}`;
  for (const rule of ACCOUNT_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.code;
  }
  return "5110"; // 判断がつかないときは消耗品費に寄せる
}

/** 少額特例（税込1万円未満）の対象かどうか */
export function isSmallAmountException(amount: number): boolean {
  return amount < 10_000;
}

/* ---------------- モック用のサンプルレシート ---------------- */

export const SAMPLE_RECEIPTS: Record<string, { label: string; text: string }> = {
  homecenter: {
    label: "ホームセンター（洗剤・掃除用品）",
    text: [
      "カインズホーム 世田谷店",
      "T1234567890999",
      "2026年8月10日 14:32",
      "",
      "住居用洗剤 詰替 x3      1,254",
      "マイクロファイバークロス  748",
      "ゴム手袋 M              398",
      "",
      "小計                  2,400",
      "消費税(10%)             240",
      "合計                  2,640",
      "現金                  3,000",
      "お釣り                  360",
    ].join("\n"),
  },
  gas: {
    label: "ガソリンスタンド（給油）",
    text: [
      "ENEOS 環七通り給油所",
      "T2345678901234",
      "2026/08/12",
      "レギュラー 32.5L @175",
      "小計                  5,687",
      "消費税(10%)             568",
      "合計                  6,255",
    ].join("\n"),
  },
  parking: {
    label: "コインパーキング（登録番号なし）",
    text: [
      "パークタイム目黒第3",
      "2026-08-13 11:05",
      "駐車料金",
      "合計                    600",
    ].join("\n"),
  },
  training: {
    label: "研修費（1万円以上・インボイスあり）",
    text: [
      "一般社団法人 整理収納協会",
      "登録番号 T3456789012345",
      "令和8年8月5日",
      "整理収納アドバイザー上級講座 受講料",
      "小計                 30,000",
      "消費税(10%)           3,000",
      "合計金額             33,000",
    ].join("\n"),
  },
};

export function sampleReceiptText(key?: string): string {
  return (SAMPLE_RECEIPTS[key ?? "homecenter"] ?? SAMPLE_RECEIPTS.homecenter).text;
}
