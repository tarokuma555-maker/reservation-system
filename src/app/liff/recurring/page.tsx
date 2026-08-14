import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge, Empty, StatusBadge } from "@/components/ui";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurring";
import { formatRange, formatYen, now, WEEKDAY_LABELS } from "@/lib/time";
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
        <h1 className="text-lg font-bold tracking-tight text-ink">定期利用</h1>
        <Link
          href="/liff/recurring/new"
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
        >
          新しく申し込む
        </Link>
      </div>

      {rules.length === 0 ? (
        <Empty>
          定期でのご利用はまだありません。
          <br />
          毎週・隔週・月1回など、ご希望のペースで登録できます。
        </Empty>
      ) : (
        rules.map((rule) => (
          <section key={rule.id} className="rounded-card border border-slate-200/80 bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-ink">
                  {FREQUENCY_LABELS[rule.frequency as Frequency] ?? rule.frequency}
                  {rule.frequency === "monthly_nth" ? ` 第${rule.nthWeek}` : " "}
                  {WEEKDAY_LABELS[rule.dayOfWeek]}曜 {rule.startTime}〜
                </p>
                <p className="text-xs text-slate-600">{rule.menu.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <DeliveryBadge type={rule.menu.deliveryType} />
                {rule.status === "paused" ? (
                  <span className="rounded bg-warn-100 px-2 py-0.5 text-2xs text-warn-700">
                    休止中
                  </span>
                ) : rule.status === "ended" ? (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-2xs text-slate-600">
                    終了
                  </span>
                ) : null}
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {formatYen(rule.menu.price)}（税込）／回
              {rule.pausedFrom ? ` ・ ${rule.pausedFrom}〜${rule.pausedTo} は休止` : ""}
            </p>

            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-600">今後の予定</p>
              {rule.reservations.length === 0 ? (
                <p className="text-xs text-slate-500">予定はありません</p>
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
                        <p className="text-[10px] text-ocean-600">この回だけ変更済み</p>
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
                            今回休む
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-3 text-2xs leading-relaxed text-slate-500">
              日時の変更は各予約の詳細から、条件の変更・お休み・解約はトークからご連絡ください。
            </p>
          </section>
        ))
      )}
    </div>
  );
}
