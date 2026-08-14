import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  Button,
  Card,
  DeliveryBadge,
  Field,
  SectionTitle,
  StatTile,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { Icon } from "@/components/Icon";
import { describeSchedule } from "@/lib/recurring";
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
  const visit = rule.menu.deliveryType === "visit";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/recurring"
          className="inline-flex items-center gap-1 text-2xs font-bold text-slate-400 transition hover:text-brand-600"
        >
          <Icon name="arrowLeft" className="h-3 w-3" />
          定期のお客様の一覧へ
        </Link>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tighter text-ink">
              {rule.customer.name} 様
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              {describeSchedule(rule)} ／ {rule.menu.name} ／ 1回 {formatYen(rule.menu.price)}（税こみ）
            </p>
          </div>
          <DeliveryBadge type={rule.menu.deliveryType} />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="これから入っている予定" value={String(upcoming.length)} unit="回" />
        <StatTile
          label="1回だけ手を入れた回"
          value={String(exceptionCount)}
          unit="回"
          sub="曜日を変えても、この回はそのまま残ります"
        />
        <StatTile
          label="いまのようす"
          value={
            rule.status === "active"
              ? "つづいています"
              : rule.status === "paused"
                ? "おやすみ中"
                : "終わりました"
          }
          sub={rule.pausedFrom ? `${rule.pausedFrom} 〜 ${rule.pausedTo}` : undefined}
        />
      </div>

      <section>
        <SectionTitle hint="ここで直した回は、あとから曜日を変えても上書きされません">
          これからの予定（1回ずつ調整できます）
        </SectionTitle>
        {upcoming.length === 0 ? (
          <Card className="text-sm text-slate-500">これから入っている予定はありません</Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    {formatRange(r.startAt, r.endAt)}
                    {r.isException ? (
                      <span className="rounded-pill bg-ocean-100 px-2 py-0.5 text-2xs font-bold text-ocean-700">
                        この回だけ変えてあります
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.menu.name}
                    {r.occurrenceDate && r.occurrenceDate !== isoOf(r.startAt)
                      ? `（もともとは ${r.occurrenceDate} でした）`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "confirmed" ? (
                    <>
                      <form action={skipOccurrence}>
                        <input type="hidden" name="reservationId" value={r.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          <Icon name="skip" className="h-3.5 w-3.5" />
                          今回はお休み
                        </Button>
                      </form>
                      <form action={switchDeliveryType} className="flex gap-1">
                        <input type="hidden" name="reservationId" value={r.id} />
                        <select
                          name="targetMenuId"
                          className="rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-xs"
                        >
                          {alternativeMenus.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.deliveryType === "visit" ? "うかがう" : "オンライン"}／{m.name}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="secondary" size="sm">
                          <Icon name={visit ? "online" : "visit"} className="h-3.5 w-3.5" />
                          今回だけ入れかえ
                        </Button>
                      </form>
                      <Link
                        href={`/admin/reservations/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        時間をずらす・くわしく
                        <Icon name="chevronRight" className="h-3 w-3" />
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
          <SectionTitle hint="すでに終わった回と、1回だけ手を入れた回は、そのまま残ります">
            曜日や時間そのものを変える
          </SectionTitle>
          <form action={changeRuleAction} className="space-y-3">
            <input type="hidden" name="ruleId" value={rule.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="曜日">
                <select name="dayOfWeek" defaultValue={rule.dayOfWeek} className={inputClass}>
                  {WEEKDAY_LABELS.map((w, i) => (
                    <option key={i} value={i}>
                      {w}曜日
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="はじまる時間">
                <input
                  type="time"
                  name="startTime"
                  step={1800}
                  defaultValue={rule.startTime}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="いつから変えるか" hint="この日より前の予定は、そのままにしておきます">
              <input
                type="date"
                name="effectiveFrom"
                defaultValue={addDays(today, 7)}
                className={inputClass}
              />
            </Field>
            <Button type="submit" className="w-full">
              <Icon name="check" className="h-4 w-4" />
              この内容に変える
            </Button>
          </form>
        </Card>

        <Card>
          <SectionTitle>しばらくお休み・また始める・やめる</SectionTitle>
          <div className="space-y-5">
            <form action={pauseRuleAction} className="space-y-2">
              <input type="hidden" name="ruleId" value={rule.id} />
              <p className="text-xs font-bold text-slate-600">
                しばらくお休みにする
                <span className="ml-1 font-normal text-slate-500">
                  （ご旅行や、お客様のご事情のときに）
                </span>
              </p>
              <div className="flex gap-2">
                <input type="date" name="from" defaultValue={today} className={inputClass} />
                <input
                  type="date"
                  name="to"
                  defaultValue={addDays(today, 21)}
                  className={inputClass}
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                <Icon name="pause" className="h-4 w-4" />
                この間をお休みにする
              </Button>
            </form>

            <div className="flex gap-2">
              <form action={resumeRuleAction} className="flex-1">
                <input type="hidden" name="ruleId" value={rule.id} />
                <Button type="submit" variant="secondary" className="w-full">
                  <Icon name="play" className="h-4 w-4" />
                  また始める
                </Button>
              </form>
              <form action={regenerateRuleAction} className="flex-1">
                <input type="hidden" name="ruleId" value={rule.id} />
                <Button type="submit" variant="secondary" className="w-full">
                  <Icon name="refresh" className="h-4 w-4" />
                  予定を作り直す
                </Button>
              </form>
            </div>

            <form action={endRuleAction} className="space-y-2">
              <input type="hidden" name="ruleId" value={rule.id} />
              <p className="text-xs font-bold text-slate-600">
                定期をやめる
                <span className="ml-1 font-normal text-slate-500">
                  （この日より後の予定を取り消します）
                </span>
              </p>
              <input type="date" name="endDate" defaultValue={today} className={inputClass} />
              <Button type="submit" variant="danger" className="w-full">
                <Icon name="close" className="h-4 w-4" />
                定期をやめる
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {pastList.length > 0 ? (
        <section>
          <SectionTitle>これまでの分</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {pastList.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
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
