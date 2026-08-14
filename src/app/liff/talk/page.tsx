import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { FlexPreview } from "@/components/FlexPreview";
import { Empty } from "@/components/ui";
import { lineMode } from "@/lib/line";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  welcome: "友だち追加のごあいさつ",
  booking_confirmed: "予約確定のお知らせ",
  rescheduled: "日時変更のお知らせ",
  cancelled: "キャンセルのお知らせ",
  skipped: "定期のお休み受付",
  reminder: "前日リマインド",
  online_soon: "オンライン開始前リマインド",
  completed: "実施後のお礼",
  invoice: "領収書・請求書の送付",
};

/** LINEのトーク画面。システムから送られた通知が並ぶ。 */
export default async function TalkPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  const messages = await prisma.outboundMessage.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <div className="min-h-[70vh] space-y-4 bg-brand-50 p-4">
      {lineMode() === "mock" ? (
        <p className="rounded-card border border-slate-200/80 bg-surface px-3.5 py-2.5 text-2xs leading-relaxed text-slate-600 shadow-card">
          お試しモードで動いています。実際のLINEには送信していませんが、
          <b>ここに出ている内容がそのままお客様に届きます</b>（同じJSONをMessaging APIへ送ります）。
        </p>
      ) : null}

      {messages.length === 0 ? (
        <Empty>まだメッセージはありません。予約をすると通知が届きます。</Empty>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="space-y-1">
            <p className="px-1 text-[10px] font-bold text-slate-500">
              {TYPE_LABEL[m.type] ?? m.type} ・{" "}
              {m.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              {m.status === "failed" ? " ・送信失敗" : ""}
            </p>
            <FlexPreview payload={m.payload} />
          </div>
        ))
      )}
    </div>
  );
}
