import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, Empty, SectionTitle } from "@/components/ui";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurring";
import { formatRange, formatYen, now, WEEKDAY_LABELS } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminRecurringList() {
  const rules = await prisma.recurringRule.findMany({
    include: {
      customer: true,
      menu: true,
      reservations: {
        where: { startAt: { gte: now() }, status: "confirmed" },
        orderBy: { startAt: "asc" },
        take: 1,
      },
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">定期予約</h1>
        <p className="text-sm text-slate-500">
          ルールの一覧です。個別の回の調整はルールを開いて行います。
        </p>
      </header>

      {rules.length === 0 ? (
        <Empty>定期ルールはまだありません</Empty>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Link key={rule.id} href={`/admin/recurring/${rule.id}`}>
              <Card className="transition hover:border-sage-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {rule.customer.name} 様 —{" "}
                      {FREQUENCY_LABELS[rule.frequency as Frequency] ?? rule.frequency}
                      {rule.frequency === "monthly_nth" ? ` 第${rule.nthWeek}` : " "}
                      {WEEKDAY_LABELS[rule.dayOfWeek]}曜 {rule.startTime}〜
                    </p>
                    <p className="text-sm text-slate-600">{rule.menu.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      次回:{" "}
                      {rule.reservations[0]
                        ? formatRange(rule.reservations[0].startAt, rule.reservations[0].endAt)
                        : "予定なし"}
                      　／　生成済み {rule._count.reservations} 回分　／
                      {formatYen(rule.menu.price)}/回
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DeliveryBadge type={rule.menu.deliveryType} />
                    <StatusPill status={rule.status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <section>
        <SectionTitle>この画面でできること</SectionTitle>
        <Card className="text-sm leading-relaxed text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>各回ごとの「今回だけスキップ」「今回だけ日時変更」「今回だけ提供形態を変更」</li>
            <li>ルール自体の条件変更（適用開始日を指定して、それ以降の未実施分だけ作り直す）</li>
            <li>一時休止と再開、終了</li>
            <li>
              <b>個別に手を入れた回は、ルール変更で上書きされません</b>
              （実施済みの回と、適用開始日より前の回も同様に保護されます）
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "稼働中", cls: "bg-sage-500 text-white" },
    paused: { label: "休止中", cls: "bg-amber-100 text-amber-700" },
    ended: { label: "終了", cls: "bg-slate-200 text-slate-600" },
  };
  const s = map[status] ?? map.ended;
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
