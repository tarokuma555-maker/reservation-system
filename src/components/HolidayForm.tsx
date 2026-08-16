"use client";

import { useActionState } from "react";
import { addHolidayAction, deleteHolidayAction, type HoursState } from "@/app/admin/hours-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Field, inputClass } from "@/components/ui";

type Holiday = { id: string; date: string; endDate: string | null; reason: string };

/** 年末年始や旅行など、決まった日のお休み */
export default function HolidayForm({
  holidays,
  today,
}: {
  holidays: Holiday[];
  today: string;
}) {
  const [addState, addAction] = useActionState<HoursState, FormData>(addHolidayAction, {});
  const [delState, delAction] = useActionState<HoursState, FormData>(deleteHolidayAction, {});

  return (
    <div className="space-y-4">
      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <Field label="この日から">
          <input type="date" name="date" defaultValue={today} className={`${inputClass} !w-44`} />
        </Field>
        <Field label="この日まで" hint="1日だけなら空のまま">
          <input type="date" name="endDate" className={`${inputClass} !w-44`} />
        </Field>
        <Field label="理由" className="min-w-[180px] flex-1">
          <input name="reason" placeholder="年末年始・旅行など" className={inputClass} />
        </Field>
        <SubmitButton icon="plus" pendingLabel="追加しています…">
          お休みにする
        </SubmitButton>
      </form>

      <FormResult ok={addState.ok ?? delState.ok} error={addState.error ?? delState.error} />

      {holidays.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-surface px-4 py-5 text-center text-xs text-slate-500">
          まだ登録がありません。曜日ごとのお休みは、上の受付時間でお決めください。
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
          {holidays.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-ink">
                {h.date}
                {h.endDate ? ` 〜 ${h.endDate}` : ""}
                {h.reason ? (
                  <span className="ml-2 text-xs text-slate-500">{h.reason}</span>
                ) : null}
              </span>
              <form action={delAction}>
                <input type="hidden" name="id" value={h.id} />
                <SubmitButton
                  variant="secondary"
                  size="sm"
                  icon="close"
                  pendingLabel="取り消しています…"
                >
                  取り消す
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
