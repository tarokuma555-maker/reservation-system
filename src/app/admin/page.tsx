import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, travelBufferMinutes, type DeliveryType } from "@/lib/settings";
import { Card, DeliveryBadge, Empty, PaymentBadge, SectionTitle, StatTile } from "@/components/ui";
import { addDays, diffMinutes, formatDateJa, formatYen, jst, todayStr, toTimeStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const settings = await getSettings();
  const today = todayStr();
  const dayStart = jst(today, "00:00");
  const dayEnd = jst(addDays(today, 1), "00:00");
  const monthStart = jst(`${today.slice(0, 7)}-01`, "00:00");

  const [todayList, unpaid, monthReservations, activeRules, uninvoiced] = await Promise.all([
    prisma.reservation.findMany({
      where: { startAt: { gte: dayStart, lt: dayEnd }, status: { in: ["confirmed", "completed"] } },
      orderBy: { startAt: "asc" },
      include: { customer: true, menu: true },
    }),
    prisma.reservation.findMany({
      where: { status: "completed", paymentStatus: "unpaid" },
      include: { customer: true, menu: true },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { startAt: { gte: monthStart, lt: dayEnd }, status: { in: ["confirmed", "completed"] } },
      select: { totalPrice: true, deliveryType: true },
    }),
    prisma.recurringRule.count({ where: { status: "active" } }),
    prisma.reservation.count({ where: { status: "completed", invoiceLines: { none: {} } } }),
  ]);

  const monthSales = monthReservations.reduce((s, r) => s + r.totalPrice, 0);
  const visitCount = monthReservations.filter((r) => r.deliveryType === "visit").length;
  const onlineCount = monthReservations.filter((r) => r.deliveryType === "online").length;
  const unpaidTotal = unpaid.reduce((s, r) => s + r.totalPrice, 0);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-2xs font-bold tracking-wide text-brand-600">
          {formatDateJa(today)} の営業
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tighter text-ink">ダッシュボード</h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="今月の売上（税込）"
          value={formatYen(monthSales)}
          sub={`訪問 ${visitCount}件 ・ オンライン ${onlineCount}件`}
          tone="brand"
        />
        <StatTile label="本日の予定" value={String(todayList.length)} unit="件" />
        <StatTile label="稼働中の定期" value={String(activeRules)} unit="本" href="/admin/recurring" />
        <StatTile
          label="未発行の書類"
          value={String(uninvoiced)}
          unit="件"
          sub={uninvoiced > 0 ? "実施済みかつ未発行" : "すべて発行済み"}
          tone={uninvoiced > 0 ? "alert" : "plain"}
          href="/admin/invoices"
        />
      </div>

      <section>
        <SectionTitle hint="予定と予定のあいだの移動時間も、提供形態の組み合わせで判定しています">
          本日の予定
        </SectionTitle>

        {todayList.length === 0 ? (
          <Empty>本日の予定はありません</Empty>
        ) : (
          <ol className="space-y-1">
            {todayList.map((r, i) => {
              const prev = todayList[i - 1];
              const gap = prev ? diffMinutes(r.startAt, prev.endAt) : null;
              const need = prev
                ? travelBufferMinutes(
                    settings,
                    prev.deliveryType as DeliveryType,
                    r.deliveryType as DeliveryType
                  )
                : 0;
              const tight = gap !== null && gap < need;

              return (
                <li key={r.id}>
                  {prev ? (
                    <div className="flex items-center gap-3 py-1.5 pl-6">
                      <span
                        className={`h-6 w-px ${tight ? "bg-bad-100" : "bg-slate-200"}`}
                        aria-hidden
                      />
                      <span
                        className={`text-2xs font-medium ${tight ? "text-bad-600" : "text-slate-400"}`}
                      >
                        移動 {gap}分（必要 {need}分）{tight ? "・足りません" : ""}
                      </span>
                    </div>
                  ) : null}

                  <Link href={`/admin/reservations/${r.id}`} className="block">
                    <Card className="flex flex-wrap items-start gap-4 transition hover:border-brand-200 hover:shadow-lift">
                      <div className="w-12 shrink-0">
                        <p className="text-base font-extrabold tabular-nums tracking-tighter text-ink">
                          {toTimeStr(r.startAt)}
                        </p>
                        <p className="text-2xs tabular-nums text-slate-400">
                          {toTimeStr(r.endAt)}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{r.customer.name} 様</p>
                        <p className="text-xs text-slate-600">{r.menu.name}</p>
                        <p className="mt-1 text-2xs text-slate-500">
                          {r.deliveryType === "visit"
                            ? r.serviceAddress
                            : "オンライン（Google Meet）"}
                        </p>
                        {r.deliveryType === "online" && r.meetingUrl ? (
                          <p className="mt-1.5 inline-flex rounded-pill bg-ocean-50 px-2.5 py-1 text-2xs font-medium text-ocean-700">
                            {r.meetingUrl.replace("https://", "")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <DeliveryBadge type={r.deliveryType} />
                        <span className="text-sm font-bold tabular-nums text-ink">
                          {formatYen(r.totalPrice)}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <SectionTitle
          hint={unpaid.length > 0 ? `合計 ${formatYen(unpaidTotal)}` : undefined}
          action={
            <Link href="/admin/invoices" className="text-xs font-bold text-brand-600 hover:underline">
              請求書を発行する →
            </Link>
          }
        >
          入金待ち
        </SectionTitle>

        {unpaid.length === 0 ? (
          <Empty>未入金の予約はありません</Empty>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200/80 bg-surface shadow-card">
            {unpaid.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reservations/${r.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-brand-50/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{r.customer.name} 様</p>
                  <p className="truncate text-2xs text-slate-500">{r.menu.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">{formatYen(r.totalPrice)}</span>
                  <PaymentBadge status={r.paymentStatus} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
