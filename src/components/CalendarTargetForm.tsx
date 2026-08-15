"use client";

import { useActionState } from "react";
import { selectCalendarAction, type ConnectState } from "@/app/connect-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";

type Choice = { id: string; summary: string; primary: boolean };

/**
 * ご予約の書き出し先をえらぶ欄。
 *
 * いま選ばれている先を必ず見せる。見せないと、押しても
 * 何も変わらないように見えて、効いていないと思われてしまう。
 */
export default function CalendarTargetForm({
  calendars,
  current,
  inputClass,
}: {
  calendars: Choice[];
  current: string;
  inputClass: string;
}) {
  const [state, formAction] = useActionState<ConnectState, FormData>(selectCalendarAction, {});

  const currentLabel =
    calendars.find((c) => c.id === current)?.summary ??
    (current === "primary" ? "ふだんお使いのカレンダー" : current);

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-ground-warm/50 px-4 py-2.5 text-xs text-slate-700">
        <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
        いまの書き出し先： <b className="text-ink">{currentLabel}</b>
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1">
          <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
            書き出し先
          </span>
          <select name="calendarId" defaultValue={current} className={inputClass}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? "（ふだんお使いのカレンダー）" : ""}
              </option>
            ))}
          </select>
        </label>

        <SubmitButton variant="secondary" icon="check" pendingLabel="変えています…">
          ここに書き出す
        </SubmitButton>
      </form>

      <FormResult ok={state.ok} error={state.error} />
    </div>
  );
}
