import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOwner } from "@/lib/session";
import { createBlockedSlot } from "@/app/actions";
import { Card, Field, SectionTitle, inputClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  addDays,
  dayOfWeekOfDateStr,
  jst,
  todayStr,
  toDateStr,
  toTimeStr,
  WEEKDAY_LABELS,
} from "@/lib/time";

export const dynamic = "force-dynamic";

const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_PX = 44;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const weekOffset = Number(w ?? 0);

  const today = todayStr();
  const todayDow = dayOfWeekOfDateStr(today);
  const weekStart = addDays(today, -todayDow + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const rangeStart = jst(days[0], "00:00");
  const rangeEnd = jst(addDays(days[6], 1), "00:00");

  const owner = await getOwner();

  const [reservations, blocks, holidays] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        startAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: ["confirmed", "completed"] },
      },
      include: { customer: true, menu: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.blockedSlot.findMany({ where: { startAt: { gte: rangeStart, lt: rangeEnd } } }),
    prisma.holiday.findMany({ where: { date: { in: days } } }),
  ]);

  const holidayDates = new Set(holidays.map((h) => h.date));

  const posOf = (start: Date, end: Date) => {
    const [sh, sm] = toTimeStr(start).split(":").map(Number);
    const [eh, em] = toTimeStr(end).split(":").map(Number);
    const top = (sh * 60 + sm - START_HOUR * 60) * (HOUR_PX / 60);
    const height = Math.max(18, (eh * 60 + em - (sh * 60 + sm)) * (HOUR_PX / 60));
    return { top, height };
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink">予定表</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {weekOffset === 0 ? "今週" : `${days[0]} 〜 ${days[6]}`}の予定です。
            予定を押すと、くわしい内容を見たり変更したりできます。
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <WeekButton href={`/admin/calendar?w=${weekOffset - 1}`}>
            <Icon name="arrowLeft" className="h-3.5 w-3.5" />
            前の週
          </WeekButton>
          <WeekButton href="/admin/calendar" current={weekOffset === 0}>
            今週
          </WeekButton>
          <WeekButton href={`/admin/calendar?w=${weekOffset + 1}`}>
            次の週
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </WeekButton>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-slate-200/80 bg-surface px-4 py-3 text-xs text-slate-600">
        <span className="font-bold text-slate-400">色の意味</span>
        <Legend className="bg-brand-500" label="おうちにうかがう" />
        <Legend className="bg-ocean-500" label="オンライン" />
        <Legend className="border border-slate-300 bg-surface" label="もう終わったお仕事" />
        <Legend
          className="border border-slate-300"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, #EADCD0 0 4px, #F5EDE5 4px 8px)",
          }}
          label="予約を受け付けない時間"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-slate-200/80 bg-surface shadow-card">
        <div className="min-w-[860px]">
          {/* 日付ヘッダー */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-200">
            <div />
            {days.map((d) => {
              const isToday = d === today;
              const isHoliday = holidayDates.has(d);
              return (
                <div
                  key={d}
                  className={`border-l border-slate-100 px-2 py-2 text-center text-xs ${
                    isToday ? "bg-brand-50 font-bold text-brand-700" : "text-slate-600"
                  }`}
                >
                  {Number(d.slice(8))}日({WEEKDAY_LABELS[dayOfWeekOfDateStr(d)]})
                  {isHoliday ? <span className="ml-1 font-bold text-bad-500">休</span> : null}
                </div>
              );
            })}
          </div>

          {/* 時間グリッド */}
          <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div
                  key={i}
                  style={{ height: HOUR_PX }}
                  className="border-b border-slate-100 pr-2 text-right text-[10px] tabular-nums text-slate-400"
                >
                  {START_HOUR + i}:00
                </div>
              ))}
            </div>

            {days.map((d) => (
              <div key={d} className="relative border-l border-slate-100">
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} style={{ height: HOUR_PX }} className="border-b border-slate-100" />
                ))}

                {blocks
                  .filter((b) => toDateStr(b.startAt) === d)
                  .map((b) => {
                    const { top, height } = posOf(b.startAt, b.endAt);
                    return (
                      <div
                        key={b.id}
                        className="absolute inset-x-1 overflow-hidden rounded-lg border border-slate-300 px-1.5 py-1 text-[10px] font-medium leading-tight text-slate-600"
                        style={{
                          top,
                          height,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, #EADCD0 0 6px, #F5EDE5 6px 12px)",
                        }}
                        title={`${b.title}（この時間は予約を受け付けません）`}
                      >
                        {b.title}
                      </div>
                    );
                  })}

                {reservations
                  .filter((r) => toDateStr(r.startAt) === d)
                  .map((r) => {
                    const { top, height } = posOf(r.startAt, r.endAt);
                    const color =
                      r.status === "completed"
                        ? "border border-slate-300 bg-surface text-slate-500"
                        : r.deliveryType === "visit"
                          ? "bg-brand-500 text-white"
                          : "bg-ocean-500 text-white";
                    return (
                      <Link
                        key={r.id}
                        href={`/admin/reservations/${r.id}`}
                        style={{ top, height }}
                        className={`absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-[10px] leading-tight shadow-sm transition hover:opacity-90 ${color}`}
                        title={`${r.customer.name} 様 / ${r.menu.name}`}
                      >
                        <span className="block font-bold tabular-nums">{toTimeStr(r.startAt)}</span>
                        <span className="block truncate">{r.customer.name}</span>
                        {r.recurringRuleId ? (
                          <span className="mt-0.5 flex items-center gap-0.5 opacity-80">
                            <Icon name="repeat" className="h-2.5 w-2.5" strokeWidth={2.4} />
                            定期
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <SectionTitle hint="通院や学校行事など、お仕事を入れたくない時間を先におさえておけます">
          予約を受け付けない時間をつくる
        </SectionTitle>
        <Card>
          <form action={createBlockedSlot} className="flex flex-wrap items-end gap-3">
            <Field label="日にち">
              <input type="date" name="date" defaultValue={today} className={inputClass} />
            </Field>
            <Field label="はじまる時間">
              <input type="time" name="time" defaultValue="13:00" step={1800} className={inputClass} />
            </Field>
            <Field label="どのくらい">
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  name="minutes"
                  defaultValue={60}
                  step={30}
                  min={30}
                  className={`${inputClass} !w-24`}
                />
                <span className="text-sm text-slate-500">分</span>
              </span>
            </Field>
            <Field label="なんの予定" className="min-w-[180px] flex-1">
              <input name="title" placeholder="通院・学校行事など" className={inputClass} />
            </Field>
            <button className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
              <Icon name="plus" className="h-4 w-4" />
              入れる
            </button>
          </form>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              ここに入れた時間は、お客様の予約画面から自動でかくれます。担当は {owner.name} さんです。
              Googleカレンダーとつなぐと、あちらに入れた私用の予定もここに出てくるようになります。
            </span>
          </p>
        </Card>
      </section>
    </div>
  );
}

function WeekButton({
  href,
  children,
  current,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-pill px-3.5 py-2 text-xs font-bold transition ${
        current
          ? "bg-brand-600 text-white shadow-card"
          : "border border-slate-200 bg-surface text-slate-600 hover:border-brand-200 hover:text-brand-700"
      }`}
    >
      {children}
    </Link>
  );
}

function Legend({
  className,
  style,
  label,
}: {
  className: string;
  style?: React.CSSProperties;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${className}`} style={style} />
      {label}
    </span>
  );
}
