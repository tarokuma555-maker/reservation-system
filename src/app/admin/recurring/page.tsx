import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, Empty, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { describeSchedule } from "@/lib/recurring";
import { formatRange, formatYen, now } from "@/lib/time";

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
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">定期のお客様</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          「毎週火曜の10時」のように決まっているお客様です。
          先の予定が自動で入るので、毎回ご予約をいただく必要がありません。
          お名前を押すと、1回ぶんだけの変更もできます。
        </p>
      </header>

      {rules.length === 0 ? (
        <Empty>まだ定期のお客様はいません</Empty>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Link key={rule.id} href={`/admin/recurring/${rule.id}`} className="block">
              <Card className="transition hover:border-brand-200 hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon name="repeat" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{rule.customer.name} 様</p>
                      <p className="mt-0.5 text-sm text-brand-700">
                        {describeSchedule(rule)}
                      </p>
                      <p className="text-xs text-slate-600">{rule.menu.name}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Icon name="calendarCheck" className="h-3.5 w-3.5 text-slate-400" />
                          次は{" "}
                          {rule.reservations[0]
                            ? formatRange(
                                rule.reservations[0].startAt,
                                rule.reservations[0].endAt
                              )
                            : "予定なし"}
                        </span>
                        <span>これまで {rule._count.reservations}回ぶん の予定を用意しました</span>
                        <span>1回 {formatYen(rule.menu.price)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
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
        <SectionTitle>お名前を押すと、こんなことができます</SectionTitle>
        <Card className="space-y-2.5 text-sm leading-relaxed text-slate-600">
          <Line>今回だけお休みにする（次回からはいつもどおり）</Line>
          <Line>今回だけ、日にちや時間をずらす</Line>
          <Line>今回だけ、うかがう形とオンラインを入れかえる</Line>
          <Line>曜日や時間そのものを変える（いつから変えるかを指定できます）</Line>
          <Line>しばらくお休みにする・また始める・やめる</Line>
          <Line>
            <b>1回だけ手を入れた回は、あとで曜日を変えても、そのまま残ります。</b>
            せっかく調整したのに上書きされてしまう、ということが起きないようにしています。
          </Line>
        </Card>
      </section>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5">
      <Icon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-good-600" strokeWidth={2.4} />
      <span>{children}</span>
    </p>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "つづいています", cls: "bg-good-600 text-white" },
    paused: { label: "おやすみ中", cls: "bg-warn-100 text-warn-700" },
    ended: { label: "終わりました", cls: "bg-slate-200 text-slate-600" },
  };
  const s = map[status] ?? map.ended;
  return (
    <span className={`rounded-pill px-2.5 py-1 text-2xs font-bold ${s.cls}`}>{s.label}</span>
  );
}
