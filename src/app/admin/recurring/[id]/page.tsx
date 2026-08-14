import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, SectionTitle, StatusBadge } from "@/components/ui";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurring";
import { addDays, formatRange, formatYen, todayStr, WEEKDAY_LABELS } from "@/lib/time";
import {
  changeRuleAction,
  endRuleAction,
  pauseRuleAction,
  regenerateRuleAction,
  resumeRuleAction,
  skipOccurrence,
  switchDeliveryType,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function RecurringDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rule = await prisma.recurringRule.findUnique({
    where: { id },
    include: {
      customer: true,
      menu: true,
      reservations: { orderBy: { startAt: "asc" }, include: { menu: true } },
    },
  });
  if (!rule) notFound();

  const alternativeMenus = await prisma.menu.findMany({
    where: {
      isPublished: true,
      deliveryType: rule.menu.deliveryType === "visit" ? "online" : "visit",
    },
    orderBy: { sortOrder: "asc" },
  });

  const today = todayStr();
  const upcoming = rule.reservations.filter((r) => r.occurrenceDate && r.occurrenceDate >= today);
  const pastList = rule.reservations.filter((r) => !r.occurrenceDate || r.occurrenceDate < today);
  const exceptionCount = rule.reservations.filter((r) => r.isException).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/recurring" className="text-xs text-slate-500 hover:underline">
            ← 定期予約の一覧
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tighter text-ink">{rule.customer.name} 様の定期利用</h1>
          <p className="text-sm text-slate-600">
            {FREQUENCY_LABELS[rule.frequency as Frequency] ?? rule.frequency}
            {rule.frequency === "monthly_nth" ? ` 第${rule.nthWeek}` : " "}
            {WEEKDAY_LABELS[rule.dayOfWeek]}曜 {rule.startTime}〜 ／ {rule.menu.name} ／{" "}
            {formatYen(rule.menu.price)}（税込）
          </p>
        </div>
        <DeliveryBadge type={rule.menu.deliveryType} />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">今後の予定</p>
          <p className="mt-1 text-lg font-bold">{upcoming.length} 回</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">個別に変更した回</p>
          <p className="mt-1 text-lg font-bold text-ocean-600">{exceptionCount} 回</p>
          <p className="text-2xs text-slate-500">ルール変更で上書きされません</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">状態</p>
          <p className="mt-1 text-lg font-bold">
            {rule.status === "active" ? "稼働中" : rule.status === "paused" ? "休止中" : "終了"}
          </p>
          {rule.pausedFrom ? (
            <p className="text-2xs text-slate-500">
              {rule.pausedFrom}〜{rule.pausedTo}
            </p>
          ) : null}
        </Card>
      </div>

      <section>
        <SectionTitle hint="この回だけの変更は、以降のルール変更から保護されます">
          今後の各回（イレギュラー対応）
        </SectionTitle>
        {upcoming.length === 0 ? (
          <Card className="text-sm text-slate-500">今後の予定はありません</Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {formatRange(r.startAt, r.endAt)}
                    {r.isException ? (
                      <span className="ml-2 rounded bg-ocean-100 px-1.5 py-0.5 text-2xs text-ocean-600">
                        この回だけ変更済み
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.menu.name}
                    {r.occurrenceDate && r.occurrenceDate !== isoOf(r.startAt)
                      ? `（本来は ${r.occurrenceDate}）`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "confirmed" ? (
                    <>
                      <form action={skipOccurrence}>
                        <input type="hidden" name="reservationId" value={r.id} />
                        <button className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
                          今回だけスキップ
                        </button>
                      </form>
                      <form action={switchDeliveryType} className="flex gap-1">
                        <input type="hidden" name="reservationId" value={r.id} />
                        <select
                          name="targetMenuId"
                          className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                        >
                          {alternativeMenus.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.deliveryType === "visit" ? "訪問" : "オンライン"}／{m.name}
                            </option>
                          ))}
                        </select>
                        <button className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
                          訪問⇄オンライン
                        </button>
                      </form>
                      <Link
                        href={`/admin/reservations/${r.id}`}
                        className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        日時変更・詳細
                      </Link>
                    </>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="適用開始日より前と、個別変更済みの回は作り直しません">
            ルールの条件を変更する
          </SectionTitle>
          <form action={changeRuleAction} className="space-y-3">
            <input type="hidden" name="ruleId" value={rule.id} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                曜日
                <select
                  name="dayOfWeek"
                  defaultValue={rule.dayOfWeek}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                >
                  {WEEKDAY_LABELS.map((w, i) => (
                    <option key={i} value={i}>
                      {w}曜日
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                開始時刻
                <input
                  type="time"
                  name="startTime"
                  step={1800}
                  defaultValue={rule.startTime}
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs text-slate-500">
              いつから適用するか
              <input
                type="date"
                name="effectiveFrom"
                defaultValue={addDays(today, 7)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
            </label>
            <button className="w-full rounded-pill bg-brand-600 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
              この条件に変更する
            </button>
          </form>
        </Card>

        <Card>
          <SectionTitle>休止・再開・終了</SectionTitle>
          <div className="space-y-4">
            <form action={pauseRuleAction} className="space-y-2">
              <input type="hidden" name="ruleId" value={rule.id} />
              <p className="text-xs text-slate-500">一時休止（期間内の回を削除します）</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="from"
                  defaultValue={today}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
                <input
                  type="date"
                  name="to"
                  defaultValue={addDays(today, 21)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>
              <button className="w-full rounded-pill border border-slate-200 bg-surface py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                この期間を休止する
              </button>
            </form>

            <div className="flex gap-2">
              <form action={resumeRuleAction} className="flex-1">
                <input type="hidden" name="ruleId" value={rule.id} />
                <button className="w-full rounded-pill border border-slate-200 bg-surface py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                  再開する
                </button>
              </form>
              <form action={regenerateRuleAction} className="flex-1">
                <input type="hidden" name="ruleId" value={rule.id} />
                <button className="w-full rounded-pill border border-slate-200 bg-surface py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                  予定を生成し直す
                </button>
              </form>
            </div>

            <form action={endRuleAction} className="space-y-2">
              <input type="hidden" name="ruleId" value={rule.id} />
              <p className="text-xs text-slate-500">終了（この日より後の未実施分を削除します）</p>
              <input
                type="date"
                name="endDate"
                defaultValue={today}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
              <button className="w-full rounded-pill border border-bad-100 bg-surface py-2.5 text-sm font-bold text-bad-600 transition hover:bg-bad-50">
                定期を終了する
              </button>
            </form>
          </div>
        </Card>
      </div>

      {pastList.length > 0 ? (
        <section>
          <SectionTitle>これまでの回</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {pastList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-slate-600">{formatRange(r.startAt, r.endAt)}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function isoOf(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
