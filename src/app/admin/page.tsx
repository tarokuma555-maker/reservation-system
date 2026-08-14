import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, travelBufferMinutes, type DeliveryType } from "@/lib/settings";
import { Card, DeliveryBadge, Empty, PaymentBadge, SectionTitle, StatTile } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { addDays, diffMinutes, formatDateJa, formatYen, jst, todayStr, toTimeStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const settings = await getSettings();
  const today = todayStr();
  const dayStart = jst(today, "00:00");
  const dayEnd = jst(addDays(today, 1), "00:00");
  const tomorrowEnd = jst(addDays(today, 2), "00:00");
  const monthStart = jst(`${today.slice(0, 7)}-01`, "00:00");

  const [todayList, unpaid, monthReservations, activeRules, uninvoiced, tomorrowCount] =
    await Promise.all([
      prisma.reservation.findMany({
        where: {
          startAt: { gte: dayStart, lt: dayEnd },
          status: { in: ["confirmed", "completed"] },
        },
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
        where: {
          startAt: { gte: monthStart, lt: dayEnd },
          status: { in: ["confirmed", "completed"] },
        },
        select: { totalPrice: true, deliveryType: true },
      }),
      prisma.recurringRule.count({ where: { status: "active" } }),
      prisma.reservation.count({ where: { status: "completed", invoiceLines: { none: {} } } }),
      prisma.reservation.count({
        where: { startAt: { gte: dayEnd, lt: tomorrowEnd }, status: "confirmed" },
      }),
    ]);

  const monthSales = monthReservations.reduce((s, r) => s + r.totalPrice, 0);
  const visitCount = monthReservations.filter((r) => r.deliveryType === "visit").length;
  const onlineCount = monthReservations.filter((r) => r.deliveryType === "online").length;
  const unpaidTotal = unpaid.reduce((s, r) => s + r.totalPrice, 0);
  const doneToday = todayList.filter((r) => r.status === "completed").length;
  const remainingToday = todayList.length - doneToday;

  // 「今日やること」。押せば片づくものだけを、片づけやすい順に並べる。
  const todos: {
    icon: IconName;
    title: string;
    detail: string;
    href: string;
    action: string;
    urgent?: boolean;
  }[] = [];

  if (remainingToday > 0) {
    todos.push({
      icon: "calendarCheck",
      title: `本日のお仕事が ${remainingToday}件 のこっています`,
      detail: "終わったら「実施済みにする」を押すと、領収書を出せるようになります",
      href: "/admin/calendar",
      action: "予定表をひらく",
    });
  }
  if (uninvoiced > 0) {
    todos.push({
      icon: "receipt",
      title: `領収書がまだの お仕事が ${uninvoiced}件 あります`,
      detail: "まとめて発行して、LINEでお送りできます",
      href: "/admin/invoices",
      action: "領収書を出す",
      urgent: true,
    });
  }
  if (unpaid.length > 0) {
    todos.push({
      icon: "wallet",
      title: `お支払いがまだの お仕事が ${unpaid.length}件 あります`,
      detail: `合計 ${formatYen(unpaidTotal)}。入金を確認したら記録しておきましょう`,
      href: "/admin/invoices",
      action: "確認する",
    });
  }
  if (tomorrowCount > 0) {
    todos.push({
      icon: "bell",
      title: `明日のご予約が ${tomorrowCount}件 あります`,
      detail: "前日のお知らせを、いまお送りできます",
      href: "/admin/messages",
      action: "お知らせを送る",
    });
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="text-2xs font-bold tracking-wide text-brand-600">{formatDateJa(today)}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tighter text-ink">ホーム</h1>
      </header>

      {/* ------------ 今日やること ------------ */}
      <section>
        <SectionTitle hint="上から順に片づければ大丈夫です">今日やること</SectionTitle>
        {todos.length === 0 ? (
          <Card className="flex items-center gap-3 border-good-100 bg-good-50">
            <Icon name="check" className="h-5 w-5 text-good-600" />
            <p className="text-sm font-bold text-good-700">
              いまやることはありません。おつかれさまです。
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {todos.map((t) => (
              <li key={t.title}>
                <Link href={t.href} className="block">
                  <Card
                    className={`flex flex-wrap items-center gap-4 transition hover:shadow-lift ${
                      t.urgent ? "border-brand-200 bg-brand-50/60" : "hover:border-brand-200"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        t.urgent ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
                      }`}
                    >
                      <Icon name={t.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">{t.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                        {t.detail}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface px-4 py-2 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
                      {t.action}
                      <Icon name="arrowRight" className="h-3.5 w-3.5" />
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------ 数字 ------------ */}
      <section>
        <SectionTitle>いまの状況</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="今月の売上"
            value={formatYen(monthSales)}
            sub={`訪問 ${visitCount}件 ・ オンライン ${onlineCount}件`}
            tone="brand"
          />
          <StatTile
            label="今日のお仕事"
            value={String(todayList.length)}
            unit="件"
            sub={doneToday > 0 ? `うち ${doneToday}件 は終わりました` : undefined}
          />
          <StatTile
            label="定期のお客様"
            value={String(activeRules)}
            unit="組"
            sub="毎回ご予約いただかなくても大丈夫な方"
            href="/admin/recurring"
          />
          <StatTile
            label="お支払い待ち"
            value={formatYen(unpaidTotal)}
            sub={unpaid.length > 0 ? `${unpaid.length}件` : "ありません"}
            href="/admin/invoices"
          />
        </div>
      </section>

      {/* ------------ 本日の予定 ------------ */}
      <section>
        <SectionTitle hint="予定と予定のあいだに、移動が間に合うかも見ています">
          今日の予定
        </SectionTitle>

        {todayList.length === 0 ? (
          <Empty>今日のご予約はありません</Empty>
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
                    <div className="flex items-center gap-2.5 py-1.5 pl-6">
                      <span
                        className={`h-6 w-px ${tight ? "bg-bad-100" : "bg-slate-200"}`}
                        aria-hidden
                      />
                      {tight ? (
                        <span className="inline-flex items-center gap-1.5 text-2xs font-bold text-bad-600">
                          <Icon name="alert" className="h-3.5 w-3.5" />
                          移動が {need - (gap ?? 0)}分 足りません（空き {gap}分／必要 {need}分）
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400">移動 {gap}分</span>
                      )}
                    </div>
                  ) : null}

                  <Link href={`/admin/reservations/${r.id}`} className="block">
                    <Card className="flex flex-wrap items-start gap-4 transition hover:border-brand-200 hover:shadow-lift">
                      <div className="w-12 shrink-0">
                        <p className="text-base font-extrabold tabular-nums tracking-tighter text-ink">
                          {toTimeStr(r.startAt)}
                        </p>
                        <p className="text-2xs tabular-nums text-slate-400">{toTimeStr(r.endAt)}</p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{r.customer.name} 様</p>
                        <p className="text-xs text-slate-600">{r.menu.name}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-2xs text-slate-500">
                          <Icon
                            name={r.deliveryType === "visit" ? "pin" : "online"}
                            className="h-3.5 w-3.5"
                          />
                          {r.deliveryType === "visit"
                            ? r.serviceAddress
                            : "オンライン（ビデオ通話）"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <DeliveryBadge type={r.deliveryType} />
                        <span className="text-sm font-bold tabular-nums text-ink">
                          {formatYen(r.totalPrice)}
                        </span>
                        {r.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-good-700">
                            <Icon name="check" className="h-3 w-3" />
                            終了
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ------------ 入金待ち ------------ */}
      {unpaid.length > 0 ? (
        <section>
          <SectionTitle hint={`合計 ${formatYen(unpaidTotal)}`}>お支払い待ちのお客様</SectionTitle>
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
        </section>
      ) : null}
    </div>
  );
}
