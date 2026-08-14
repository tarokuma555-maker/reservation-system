import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { FlexPreview } from "@/components/FlexPreview";
import { Empty } from "@/components/ui";
import { lineMode } from "@/lib/line";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  welcome: "友だち追加のごあいさつ",
  booking_confirmed: "ご予約を承りました",
  rescheduled: "日時が変わりました",
  cancelled: "お取り消しのお知らせ",
  skipped: "今回のお休みを承りました",
  reminder: "明日おうかがいします",
  online_soon: "まもなく始まります",
  completed: "ありがとうございました",
  invoice: "領収書をお送りしました",
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
          いまは お試しモード です。実際のLINEには送っていませんが、
          <b>ここに出ている見た目のまま、お客様のトーク画面に届きます</b>。
        </p>
      ) : null}

      {messages.length === 0 ? (
        <Empty>まだメッセージはありません。ご予約いただくと、ここにお知らせが届きます。</Empty>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="space-y-1">
            <p className="px-1 text-[10px] font-bold text-slate-500">
              {TYPE_LABEL[m.type] ?? m.type} ・{" "}
              {m.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              {m.status === "failed" ? " ・届きませんでした" : ""}
            </p>
            <FlexPreview payload={m.payload} />
          </div>
        ))
      )}
    </div>
  );
}
