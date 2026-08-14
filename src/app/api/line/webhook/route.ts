import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isLineLive, verifyLineSignature } from "@/lib/line";
import { notifyWelcome } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * LINE Messaging API の Webhook 受け口。
 *
 * - 署名検証（X-Line-Signature）を必ず通す
 * - イベントIDで冪等にし、再送されても二重処理しない
 * - 友だち追加・ブロック・メッセージ・ポストバックを処理する
 *
 * LINE_CHANNEL_SECRET が未設定のとき（モックモード）は署名検証を省略し、
 * デモから疑似イベントを流し込めるようにしている。
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if ((await isLineLive()) && !(await verifyLineSignature(rawBody, signature))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: { events?: LineWebhookEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const results = [];
  for (const event of body.events ?? []) {
    results.push(await handleEvent(event));
  }

  return NextResponse.json({ ok: true, handled: results });
}

type LineWebhookEvent = {
  type: string;
  webhookEventId?: string;
  timestamp?: number;
  source?: { userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
};

async function handleEvent(event: LineWebhookEvent) {
  const eventId = event.webhookEventId ?? `${event.type}-${event.timestamp ?? Date.now()}`;

  // 冪等性: 同じイベントIDは一度しか処理しない
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (existing) return { eventId, skipped: "既に処理済み" };

  const record = await prisma.webhookEvent.create({
    data: {
      eventId,
      type: event.type,
      lineUserId: event.source?.userId ?? null,
      payload: JSON.stringify(event, null, 2),
    },
  });

  const lineUserId = event.source?.userId;
  let note = "";

  if (lineUserId) {
    const customer = await prisma.customer.findUnique({ where: { lineUserId } });

    switch (event.type) {
      case "follow": {
        // 本番では profile API で表示名を取得して顧客を作る
        const c =
          customer ??
          (await prisma.customer.create({
            data: { lineUserId, name: "新しいお客様", tags: "新規" },
          }));
        await notifyWelcome(c.id);
        note = "友だち追加 → 挨拶メッセージを送信";
        break;
      }
      case "unfollow": {
        if (customer) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { tags: appendTag(customer.tags, "ブロック中") },
          });
        }
        note = "ブロック → 顧客にフラグを立てる（以降の通知は届かない）";
        break;
      }
      case "message": {
        note = `メッセージ受信: ${event.message?.text ?? event.message?.type ?? ""}`;
        break;
      }
      case "postback": {
        note = `ボタン操作: ${event.postback?.data ?? ""}`;
        break;
      }
      default:
        note = `未対応のイベント種別: ${event.type}`;
    }
  } else {
    note = "ユーザーIDのないイベント";
  }

  await prisma.webhookEvent.update({
    where: { id: record.id },
    data: { processed: true, note },
  });

  return { eventId, note };
}

function appendTag(tags: string, tag: string): string {
  const list = tags.split(",").filter(Boolean);
  if (!list.includes(tag)) list.push(tag);
  return list.join(",");
}
