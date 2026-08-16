"use client";

import { useActionState, useState } from "react";
import {
  saveBusinessHoursAction,
  saveOnlineHoursAction,
  type HoursState,
} from "@/app/admin/hours-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";
import { inputClass } from "@/components/ui";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export type DayRow = { dayOfWeek: number; isClosed: boolean; openTime: string; closeTime: string };

/** 曜日ごとの受付時間。ここを変えると、お客様に出る空き時間がすぐ変わる。 */
export function WeeklyHoursForm({ rows }: { rows: DayRow[] }) {
  const [state, formAction] = useActionState<HoursState, FormData>(saveBusinessHoursAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        {rows.map((r) => (
          <DayLine key={r.dayOfWeek} row={r} />
        ))}
      </div>

      <FormResult ok={state.ok} error={state.error} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton icon="check" pendingLabel="保存しています…">
          この時間で保存する
        </SubmitButton>
        <p className="text-2xs text-slate-500">
          保存すると、お客様の予約画面にすぐ反映されます
        </p>
      </div>
    </form>
  );
}

function DayLine({ row }: { row: DayRow }) {
  const [closed, setClosed] = useState(row.isClosed);
  const d = row.dayOfWeek;
  const weekend = d === 0 || d === 6;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
        closed ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-surface"
      }`}
    >
      <span
        className={`w-8 shrink-0 text-sm font-bold ${
          d === 0 ? "text-bad-600" : d === 6 ? "text-ocean-600" : "text-ink"
        }`}
      >
        {WEEKDAY[d]}
      </span>

      <label className="flex shrink-0 items-center gap-2">
        <input
          type="checkbox"
          name={`closed_${d}`}
          defaultChecked={row.isClosed}
          onChange={(e) => setClosed(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-xs text-slate-600">お休み</span>
      </label>

      {closed ? (
        <span className="text-xs text-slate-400">この曜日はご予約を受けません</span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            name={`open_${d}`}
            defaultValue={row.openTime}
            step={1800}
            className={`${inputClass} !w-32`}
          />
          <span className="text-sm text-slate-500">〜</span>
          <input
            type="time"
            name={`close_${d}`}
            defaultValue={row.closeTime}
            step={1800}
            className={`${inputClass} !w-32`}
          />
          {weekend ? (
            <span className="text-2xs text-slate-400">（土日も受ける場合はそのまま）</span>
          ) : null}
        </span>
      )}
    </div>
  );
}

/** オンラインだけ、遅い時間も受けたいとき用 */
export function OnlineHoursForm({
  enabled,
  days,
  openTime,
  closeTime,
}: {
  enabled: boolean;
  days: number[];
  openTime: string;
  closeTime: string;
}) {
  const [state, formAction] = useActionState<HoursState, FormData>(saveOnlineHoursAction, {});
  const [on, setOn] = useState(enabled);

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-xs leading-relaxed text-slate-700">
          オンラインだけ、上の時間とは別に受け付ける
          <span className="mt-0.5 block text-2xs text-slate-500">
            移動がいらないので、夜の時間も受けられます。訪問の受付時間は変わりません。
          </span>
        </span>
      </label>

      {on ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-ground-warm/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              name="openTime"
              defaultValue={openTime}
              step={1800}
              className={`${inputClass} !w-32`}
            />
            <span className="text-sm text-slate-500">〜</span>
            <input
              type="time"
              name="closeTime"
              defaultValue={closeTime}
              step={1800}
              className={`${inputClass} !w-32`}
            />
          </div>

          <div>
            <p className="mb-1.5 text-2xs font-bold tracking-wide text-slate-600">受ける曜日</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY.map((label, d) => (
                <label
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-slate-200 bg-surface px-3 py-1.5"
                >
                  <input
                    type="checkbox"
                    name="days"
                    value={d}
                    defaultChecked={days.includes(d)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <FormResult ok={state.ok} error={state.error} />

      <SubmitButton variant="secondary" icon="check" pendingLabel="保存しています…">
        {on ? "この時間で保存する" : "オンラインの夜枠をやめる"}
      </SubmitButton>

      {!on ? (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          チェックを外して保存すると、オンラインも上の曜日ごとの時間だけで受け付けます。
        </p>
      ) : null}
    </form>
  );
}
