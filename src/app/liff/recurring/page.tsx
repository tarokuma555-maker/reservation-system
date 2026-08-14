import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge, Empty, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { describeSchedule } from "@/lib/recurring";
import { formatRange, formatYen, now } from "@/lib/time";
import { skipOccurrence } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  const rules = await prisma.recurringRule.findMany({
    where: { customerId: customer.id },
    include: {
      menu: true,
      reservations: {
        where: { startAt: { gte: now() } },
        orderBy: { startAt: "asc" },
        take: 6,
        include: { menu: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-ink">いつものご予約</h1>
        <Link
          href="/liff/recurring/new"
          className="inline-flex items-center gap-1 rounded-pill bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-card"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          新しく申し込む
        </Link>
      </div>

      {rules.length === 0 ? (
        <Empty>
          まだお申し込みはありません。
          <br />
          毎週・隔週・月に1回など、ご都合のよいペースで登録しておけば、
          <br />
          毎回ご予約いただかなくても大丈夫になります。
        </Empty>
      ) : (
        rules.map((rule) => (
          <section key={rule.id} className="rounded-card border border-slate-200/80 bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-ink">
                  {describeSchedule(rule)}
                </p>
                <p className="text-xs text-slate-600">{rule.menu.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <DeliveryBadge type={rule.menu.deliveryType} />
                {rule.status === "paused" ? (
                  <span className="rounded bg-warn-100 px-2 py-0.5 text-2xs text-warn-700">
                    おやすみ中
                  </span>
                ) : rule.status === "ended" ? (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-2xs text-slate-600">
                    終わりました
                  </span>
                ) : null}
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {formatYen(rule.menu.price)}（税こみ）／1回あたり
              {rule.pausedFrom ? ` ・ ${rule.pausedFrom}〜${rule.pausedTo} はおやすみ` : ""}
            </p>

            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-600">これから入っている予定</p>
              {rule.reservations.length === 0 ? (
                <p className="text-xs text-slate-500">まだ予定はありません</p>
              ) : (
                rule.reservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-700">
                        {formatRange(r.startAt, r.endAt)}
                      </p>
                      {r.isException ? (
                        <p className="text-[10px] text-ocean-600">この回だけ変更しています</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.status === "confirmed" ? (
                        <form action={skipOccurrence}>
                          <input type="hidden" name="reservationId" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-pill border border-slate-200 bg-surface px-2.5 py-1 text-2xs font-bold text-slate-600 transition hover:border-brand-300"
                          >
                            今回はお休み
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-3 text-2xs leading-relaxed text-slate-500">
              日にちや時間を変えたいときは、上の予定を押してください。
              曜日そのものを変えたいとき、しばらくお休みしたいとき、やめたいときは、
              トークからひとことお知らせいただければこちらで手続きします。
            </p>
          </section>
        ))
      )}
    </div>
  );
}
