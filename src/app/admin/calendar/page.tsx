import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOwner } from "@/lib/session";
import { createBlockedSlot } from "@/app/actions";
import { Card, SectionTitle } from "@/components/ui";
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">スケジュール</h1>
          <p className="text-sm text-slate-500">
            {days[0]} 〜 {days[6]}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/calendar?w=${weekOffset - 1}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5">
            ← 前の週
          </Link>
          <Link href="/admin/calendar" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5">
            今週
          </Link>
          <Link href={`/admin/calendar?w=${weekOffset + 1}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5">
            次の週 →
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <Legend className="bg-sage-500" label="訪問" />
        <Legend className="bg-clay-500" label="オンライン" />
        <Legend className="bg-slate-400" label="ブロック枠（私用・Google連携）" />
        <Legend className="bg-slate-300" label="実施済" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                    isToday ? "bg-sage-50 font-bold text-sage-700" : "text-slate-600"
                  }`}
                >
                  {Number(d.slice(8))}日({WEEKDAY_LABELS[dayOfWeekOfDateStr(d)]})
                  {isHoliday ? <span className="ml-1 text-rose-500">休</span> : null}
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
                  className="border-b border-slate-100 pr-2 text-right text-[10px] text-slate-400"
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
                        style={{ top, height }}
                        className="absolute inset-x-1 overflow-hidden rounded bg-slate-400 px-1 py-0.5 text-[10px] leading-tight text-white"
                        title={b.title}
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
                        ? "bg-slate-300 text-slate-700"
                        : r.deliveryType === "visit"
                          ? "bg-sage-500 text-white"
                          : "bg-clay-500 text-white";
                    return (
                      <Link
                        key={r.id}
                        href={`/admin/reservations/${r.id}`}
                        style={{ top, height }}
                        className={`absolute inset-x-1 overflow-hidden rounded px-1 py-0.5 text-[10px] leading-tight ${color}`}
                        title={`${r.customer.name} / ${r.menu.name}`}
                      >
                        <span className="block font-bold">
                          {r.deliveryType === "visit" ? "🏠" : "💻"} {toTimeStr(r.startAt)}
                        </span>
                        <span className="block truncate">{r.customer.name}</span>
                        {r.recurringRuleId ? <span className="block opacity-80">定期</span> : null}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <SectionTitle hint="私用の予定を入れておくと、その時間は予約を受け付けません">
          ブロック枠を追加する
        </SectionTitle>
        <Card>
          <form action={createBlockedSlot} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              日付
              <input
                type="date"
                name="date"
                defaultValue={today}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              開始
              <input
                type="time"
                name="time"
                defaultValue="13:00"
                step={1800}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              長さ（分）
              <input
                type="number"
                name="minutes"
                defaultValue={60}
                step={30}
                min={30}
                className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="min-w-[160px] flex-1 text-xs text-slate-500">
              内容
              <input
                name="title"
                placeholder="通院・学校行事など"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white">
              追加
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            担当: {owner.name}（本番ではGoogleカレンダーの私用予定もここに自動で取り込まれます）
          </p>
        </Card>
      </section>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}
