import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge, Empty, StatusBadge } from "@/components/ui";
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
        <h1 className="mb-3 text-lg font-bold text-ink">今後のご予約</h1>
        {upcoming.length === 0 ? (
          <Empty>今後のご予約はありません</Empty>
        ) : (
          <div className="space-y-3">
            {upcoming.map((r) => (
              <Link key={r.id} href={`/liff/reservations/${r.id}`} className="block">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sage-400">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink">{formatRange(r.startAt, r.endAt)}</p>
                    <DeliveryBadge type={r.deliveryType} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.menu.name}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{formatYen(r.totalPrice)}（税込）</span>
                    {r.recurringRuleId ? (
                      <span className="rounded bg-sage-50 px-2 py-0.5 text-sage-700">定期</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-600">これまでのご利用</h2>
        {past.length === 0 ? (
          <Empty>履歴はまだありません</Empty>
        ) : (
          <div className="space-y-2">
            {past.map((r) => (
              <Link key={r.id} href={`/liff/reservations/${r.id}`} className="block">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
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
