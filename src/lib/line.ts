import crypto from "node:crypto";
import { prisma } from "./db";
import { cache } from "react";
import { getConnection, getCredentials } from "./connections";

/**
 * LINE Messaging API クライアント。
 *
 * 合いことば（チャネルアクセストークンとチャネルシークレット）が入っていれば
 * 実際にAPIを叩き、入っていなければHTTPを送らずDBに記録するだけになる。
 * どちらの場合も、実際に送信されるJSONは同じものを組み立てて保存するため、
 * 合いことばを入れるだけで実接続に切り替わる。
 *
 * 合いことばの置き場所は2つある。管理画面から入れた値（DB）を優先し、
 * 無ければ環境変数を見る。画面から設定できるようにしたのは、
 * ITに詳しくない方でもご自身でつなぎこめるようにするため。
 */

const API_BASE = "https://api.line.me/v2/bot";

export type LineCredentials = {
  accessToken: string;
  channelSecret: string;
  /** LIFFアプリのID。お客様の画面をLINE内で開くために使う */
  liffId?: string;
};

function credentialsFromEnv(): LineCredentials | null {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return null;
  return {
    accessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
    liffId: process.env.LIFF_ID,
  };
}

/** 1回の画面表示のあいだは、読み直さない（あちこちから呼ばれるため） */
export const getLineCredentials = cache(async function getLineCredentials(): Promise<LineCredentials | null> {
  const { credentials } = await getCredentials<LineCredentials>("line", credentialsFromEnv);
  return credentials;
});

export const getLineConnection = cache(async function getLineConnection() {
  return getConnection("line", () => Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN));
});

export async function isLineLive(): Promise<boolean> {
  const c = await getLineCredentials();
  return Boolean(c?.accessToken);
}

export async function lineMode(): Promise<"live" | "mock"> {
  return (await isLineLive()) ? "live" : "mock";
}

/**
 * 合いことばが本物か、その場で確かめる。
 *
 * 保存する前に必ず通す。まちがった値を保存してしまうと
 * 「送ったつもりで届いていない」という、いちばん気づきにくい壊れ方をするため。
 */
export async function testLineCredentials(
  accessToken: string
): Promise<{ ok: true; botName: string; basicId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      return {
        ok: false,
        error:
          "この合いことばではLINEに入れませんでした。コピーもれや、余分な空白が入っていないかご確認ください。",
      };
    }
    if (!res.ok) {
      return { ok: false, error: `LINEからの返事: ${res.status}` };
    }

    const info = (await res.json()) as { displayName?: string; basicId?: string };
    return {
      ok: true,
      botName: info.displayName ?? "名前を取得できませんでした",
      basicId: info.basicId ?? "",
    };
  } catch (e) {
    return {
      ok: false,
      error: `LINEにつながりませんでした: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** LINEから届いたお知らせが本物かどうかを確かめる。実接続では必須。 */
export async function verifyLineSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  const credentials = await getLineCredentials();
  const secret = credentials?.channelSecret;
  if (!secret) return false;
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** LINEに登録されているお客様の表示名などを取る（友だち追加のときに使う） */
export async function fetchLineProfile(
  lineUserId: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const credentials = await getLineCredentials();
  if (!credentials?.accessToken) return null;
  try {
    const res = await fetch(`${API_BASE}/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { displayName: string; pictureUrl?: string };
  } catch {
    return null;
  }
}

async function callLineApi(path: string, body: unknown, method = "POST") {
  const credentials = await getLineCredentials();
  const accessToken = credentials?.accessToken;
  if (!accessToken) throw new Error("LINEにつながっていません");
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    // GET と DELETE に本文を付けるとLINEに拒否される
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE API ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export type LineMessage = Record<string, unknown>;

/**
 * プッシュメッセージを送る。送信内容は必ず OutboundMessage に残す。
 * つながっていない状態でも同じレコードが作られるので、管理画面で内容を確認できる。
 */
export async function pushMessage(params: {
  customerId: string;
  type: string;
  messages: LineMessage[];
  reservationId?: string | null;
}) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: params.customerId } });

  const payload = { to: customer.lineUserId, messages: params.messages };

  const record = await prisma.outboundMessage.create({
    data: {
      customerId: customer.id,
      reservationId: params.reservationId ?? null,
      type: params.type,
      payload: JSON.stringify(payload, null, 2),
      status: "queued",
    },
  });

  if (!(await isLineLive())) {
    return prisma.outboundMessage.update({
      where: { id: record.id },
      data: { status: "mocked", sentAt: new Date() },
    });
  }

  try {
    await callLineApi("/message/push", payload);
    return await prisma.outboundMessage.update({
      where: { id: record.id },
      data: { status: "sent", sentAt: new Date() },
    });
  } catch (e) {
    return prisma.outboundMessage.update({
      where: { id: record.id },
      data: { status: "failed", errorMessage: e instanceof Error ? e.message : String(e) },
    });
  }
}

/* ---------------- メッセージの組み立て ---------------- */

const ACCENT = "#D2500F"; // 訪問
const ACCENT_ONLINE = "#0F6E6A"; // オンライン

export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}

type FlexRow = { label: string; value: string; wrap?: boolean };

/** 予約系の通知に使う共通のカード */
export function flexCard(params: {
  altText: string;
  title: string;
  subtitle?: string;
  rows: FlexRow[];
  notice?: string;
  buttons?: { label: string; uri: string }[];
  accent?: "visit" | "online";
}): LineMessage {
  const color = params.accent === "online" ? ACCENT_ONLINE : ACCENT;

  return {
    type: "flex",
    altText: params.altText,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: color,
        paddingAll: "16px",
        contents: [
          { type: "text", text: params.title, color: "#FFFFFF", weight: "bold", size: "md" },
          ...(params.subtitle
            ? [{ type: "text", text: params.subtitle, color: "#FFFFFFCC", size: "xs", margin: "sm" }]
            : []),
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          ...params.rows.map((r) => ({
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              { type: "text", text: r.label, color: "#8C7461", size: "sm", flex: 3 },
              {
                type: "text",
                text: r.value,
                wrap: r.wrap ?? true,
                color: "#2B1A10",
                size: "sm",
                flex: 7,
              },
            ],
          })),
          ...(params.notice
            ? [
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  paddingAll: "10px",
                  backgroundColor: "#FFF3EA",
                  cornerRadius: "6px",
                  contents: [
                    { type: "text", text: params.notice, wrap: true, size: "xs", color: "#666666" },
                  ],
                },
              ]
            : []),
        ],
      },
      ...(params.buttons?.length
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: params.buttons.map((b) => ({
                type: "button",
                style: "primary",
                color,
                height: "sm",
                action: { type: "uri", label: b.label, uri: b.uri },
              })),
            },
          }
        : {}),
    },
  };
}

/* ---------------- リッチメニュー ---------------- */

export type RichMenuArea = { label: string; icon: string; path: string };

/**
 * Messaging API に登録するリッチメニューのJSONを組み立てる。
 * 2行×3列（2500×1686）の標準サイズ。
 */
/**
 * メニューから開くURLを組み立てる。
 *
 * ふつうのWebアドレスを入れてはいけない。LINEの中では開くものの
 * 「LIFFとして」開かれないため、どなたが押したのか分からなくなる。
 * liff.line.me 宛にすると、LINEが本人の情報を添えて開いてくれる。
 */
export function liffLink(liffId: string, path: string): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `https://liff.line.me/${liffId}${suffix ?? ""}`;
}

export function buildRichMenuPayload(params: {
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
  liffId: string;
}) {
  const cols = 3;
  const cellW = Math.floor(2500 / cols);
  const cellH = 843;

  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: params.name,
    chatBarText: params.chatBarText,
    areas: params.areas.slice(0, 6).map((a, i) => ({
      bounds: {
        x: (i % cols) * cellW,
        y: Math.floor(i / cols) * cellH,
        width: cellW,
        height: cellH,
      },
      action: { type: "uri", label: a.label, uri: liffLink(params.liffId, a.path) },
    })),
  };
}

/**
 * リッチメニューを登録する。
 *
 * LINEは**背景画像のないメニューを受け付けない**ため、作ったらすぐ画像を送る。
 * 画像は同梱してある（本番のサーバーには日本語フォントもブラウザも無く、
 * その場では作れないため、あらかじめ作って持たせている）。
 */
export async function registerRichMenu(
  payload: ReturnType<typeof buildRichMenuPayload>,
  imagePath: string
) {
  if (!(await isLineLive())) {
    return { richMenuId: `mock-${Date.now()}`, mocked: true };
  }

  const res = (await callLineApi("/richmenu", payload)) as { richMenuId: string };

  try {
    await uploadRichMenuImage(res.richMenuId, imagePath);
  } catch (e) {
    // 画像を送れなかったメニューは使えない。中途半端なものを残さず片づける。
    await deleteRichMenu(res.richMenuId).catch(() => {});
    throw e;
  }

  return { richMenuId: res.richMenuId, mocked: false };
}

/** 背景画像を送る。画像だけは別の宛先（api-data）になっている。 */
async function uploadRichMenuImage(richMenuId: string, imagePath: string) {
  const { readFile } = await import("node:fs/promises");
  const image = await readFile(imagePath);

  const credentials = await getLineCredentials();
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials?.accessToken}`,
      "Content-Type": "image/png",
    },
    body: new Uint8Array(image),
  });

  if (!res.ok) {
    throw new Error(`メニューの画像を送れませんでした (${res.status}: ${await res.text()})`);
  }
}

export async function deleteRichMenu(richMenuId: string) {
  if (!(await isLineLive())) return;
  await callLineApi(`/richmenu/${richMenuId}`, null, "DELETE");
}

/** すべての方に出す既定のメニューにする */
export async function setDefaultRichMenu(richMenuId: string) {
  if (!(await isLineLive())) return { mocked: true };
  await callLineApi(`/user/all/richmenu/${richMenuId}`, {}, "POST");
  return { mocked: false };
}

export async function linkRichMenuToUser(lineUserId: string, richMenuId: string) {
  if (!(await isLineLive())) return { mocked: true };
  await callLineApi(`/user/${lineUserId}/richmenu/${richMenuId}`, {}, "POST");
  return { mocked: false };
}
