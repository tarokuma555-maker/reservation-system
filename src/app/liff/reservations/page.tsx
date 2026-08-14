import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge, Empty, StatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatRange, formatYen, now } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  const [upcoming, past] = await Promise.all([
    prisma.reservation.findMany({
      where: { customerId: customer.id, startAt: { gte: now() }, status: { in: ["confirmed"] } },
      orderBy: { startAt: "asc" },
      include: { menu: true },
    }),
    prisma.reservation.findMany({
      where: {
        customerId: customer.id,
        OR: [{ startAt: { lt: now() } }, { status: { not: "confirmed" } }],
      },
      orderBy: { startAt: "desc" },
      take: 20,
      include: { menu: true },
    }),
  ]);

  return (
    <div className="space-y-6 p-4">
      <section>
        <h1 className="mb-1 text-lg font-bold tracking-tight text-ink">これからのご予約</h1>
        <p className="mb-3 text-xs text-slate-500">
          押すと、日にちの変更やお取り消しができます。
        </p>
        {upcoming.length === 0 ? (
          <Empty>いまご予約はありません。下のメニューからお申し込みいただけます。</Empty>
        ) : (
          <div className="space-y-3">
            {upcoming.map((r) => (
              <Link key={r.id} href={`/liff/reservations/${r.id}`} className="block">
                <div className="rounded-card border border-slate-200/80 bg-surface p-5 shadow-card transition hover:border-brand-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink">{formatRange(r.startAt, r.endAt)}</p>
                    <DeliveryBadge type={r.deliveryType} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.menu.name}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{formatYen(r.totalPrice)}（税こみ）</span>
                    {r.recurringRuleId ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2.5 py-0.5 font-bold text-brand-700">
                        <Icon name="repeat" className="h-3 w-3" />
                        定期
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 inline-flex items-center gap-1 text-2xs font-bold text-brand-700">
                    変更・お取り消しはこちら
                    <Icon name="chevronRight" className="h-3 w-3" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-600">これまでのご利用</h2>
        {past.length === 0 ? (
          <Empty>まだご利用がありません</Empty>
        ) : (
          <div className="space-y-2">
            {past.map((r) => (
              <Link key={r.id} href={`/liff/reservations/${r.id}`} className="block">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">
                      {formatRange(r.startAt, r.endAt)}
                    </p>
                    <p className="truncate text-xs text-slate-500">{r.menu.name}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
