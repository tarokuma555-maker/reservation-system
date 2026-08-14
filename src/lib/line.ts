import crypto from "node:crypto";
import { prisma } from "./db";

/**
 * LINE Messaging API クライアント。
 *
 * LINE_CHANNEL_ACCESS_TOKEN が設定されていれば実際にAPIを叩き（ライブモード）、
 * 未設定ならHTTPを送らずDBに記録するだけになる（モックモード）。
 * どちらのモードでも、実際に送信されるJSONは同じものを組み立てて保存するため、
 * 認証情報を入れるだけで実接続に切り替わる。
 */

const API_BASE = "https://api.line.me/v2/bot";

export function isLineLive(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export function lineMode(): "live" | "mock" {
  return isLineLive() ? "live" : "mock";
}

/** Webhookの署名検証。ライブ運用では必須。 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function callLineApi(path: string, body: unknown, method = "POST") {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
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
 * モックモードでも同じレコードが作られるので、管理画面とトーク画面で確認できる。
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

  if (!isLineLive()) {
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

const ACCENT = "#47705F";
const ACCENT_ONLINE = "#A9603C";

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
              { type: "text", text: r.label, color: "#8C8C8C", size: "sm", flex: 3 },
              {
                type: "text",
                text: r.value,
                wrap: r.wrap ?? true,
                color: "#333333",
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
                  backgroundColor: "#F5F5F3",
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
export function buildRichMenuPayload(params: {
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
  liffBaseUrl: string;
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
      action: { type: "uri", label: a.label, uri: `${params.liffBaseUrl}${a.path}` },
    })),
  };
}

/** リッチメニューを登録し、対象ユーザーにリンクする（ライブモードのみ実際に呼ばれる） */
export async function registerRichMenu(payload: ReturnType<typeof buildRichMenuPayload>) {
  if (!isLineLive()) {
    return { richMenuId: `mock-${Date.now()}`, mocked: true };
  }
  const res = (await callLineApi("/richmenu", payload)) as { richMenuId: string };
  return { richMenuId: res.richMenuId, mocked: false };
}

export async function linkRichMenuToUser(lineUserId: string, richMenuId: string) {
  if (!isLineLive()) return { mocked: true };
  await callLineApi(`/user/${lineUserId}/richmenu/${richMenuId}`, {}, "POST");
  return { mocked: false };
}
