import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, travelBufferMinutes, type DeliveryType } from "@/lib/settings";
import { Card, DeliveryBadge, Empty, PaymentBadge, SectionTitle } from "@/components/ui";
import { addDays, diffMinutes, formatYen, jst, todayStr, toTimeStr } from "@/lib/time";

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
      select: { totalPrice: true, deliveryType: true, totalMinutes: true },
    }),
    prisma.recurringRule.count({ where: { status: "active" } }),
    prisma.reservation.count({
      where: { status: "completed", invoiceLines: { none: {} } },
    }),
  ]);

  const monthSales = monthReservations.reduce((s, r) => s + r.totalPrice, 0);
  const visitCount = monthReservations.filter((r) => r.deliveryType === "visit").length;
  const onlineCount = monthReservations.filter((r) => r.deliveryType === "online").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold text-ink">ダッシュボード</h1>
        <p className="text-sm text-slate-500">{today}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="今月の売上（税込）" value={formatYen(monthSales)} />
        <Stat label="今月の件数" value={`訪問 ${visitCount} / オンライン ${onlineCount}`} />
        <Stat label="稼働中の定期ルール" value={`${activeRules} 本`} />
        <Stat
          label="未発行の書類"
          value={`${uninvoiced} 件`}
          accent={uninvoiced > 0}
          href="/admin/invoices"
        />
      </div>

      <section>
        <SectionTitle hint="移動時間は前後の提供形態の組み合わせで判定しています">
          本日の予定
        </SectionTitle>
        {todayList.length === 0 ? (
          <Empty>本日の予定はありません</Empty>
        ) : (
          <div className="space-y-2">
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
              return (
                <div key={r.id}>
                  {prev ? (
                    <div
                      className={`ml-4 border-l-2 py-1 pl-4 text-xs ${
                        gap !== null && gap < need
                          ? "border-rose-300 text-rose-600"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      移動 {gap}分（必要 {need}分）
                      {gap !== null && gap < need ? " ⚠️ 足りません" : ""}
                    </div>
                  ) : null}
                  <Link href={`/admin/reservations/${r.id}`}>
                    <Card className="transition hover:border-sage-400">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-ink">
                            {toTimeStr(r.startAt)}–{toTimeStr(r.endAt)} {r.customer.name} 様
                          </p>
                          <p className="text-sm text-slate-600">{r.menu.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {r.deliveryType === "visit"
                              ? r.serviceAddress
                              : "オンライン（Google Meet）"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <DeliveryBadge type={r.deliveryType} />
                          <span className="text-sm font-medium">{formatYen(r.totalPrice)}</span>
                        </div>
                      </div>
                      {r.deliveryType === "online" && r.meetingUrl ? (
                        <p className="mt-2 rounded bg-clay-100 px-2 py-1 text-xs text-clay-600">
                          参加URL: {r.meetingUrl}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>入金待ち</SectionTitle>
        {unpaid.length === 0 ? (
          <Empty>未入金の予約はありません</Empty>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {unpaid.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reservations/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.customer.name} 様</p>
                  <p className="truncate text-xs text-slate-500">{r.menu.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm">{formatYen(r.totalPrice)}</span>
                  <PaymentBadge status={r.paymentStatus} />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: boolean;
  href?: string;
}) {
  const body = (
    <Card className={accent ? "border-clay-500/40 bg-clay-100" : ""}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
