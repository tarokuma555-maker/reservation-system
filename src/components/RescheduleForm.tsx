"use client";

import { useEffect, useState, useTransition } from "react";
import { rescheduleReservation } from "@/app/actions";

type Props = {
  reservationId: string;
  menuId: string;
  dates: string[];
  dateLabels: string[];
  by?: "customer" | "owner";
};

export default function RescheduleForm({ reservationId, menuId, dates, dateLabels, by = "customer" }: Props) {
  const [date, setDate] = useState(dates[0]);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ time: string; available: boolean; reason?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTime(null);
    fetch(`/api/slots?date=${date}&menuId=${menuId}&exclude=${reservationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots(d.slots ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, menuId, reservationId]);

  return (
    <form action={(fd) => startTransition(() => void rescheduleReservation(fd))} className="space-y-3">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="by" value={by} />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {dates.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={`min-w-[64px] shrink-0 rounded-lg border px-2 py-1.5 text-xs ${
              date === d ? "border-sage-600 bg-sage-600 text-white" : "border-slate-200 bg-white"
            }`}
          >
            {dateLabels[i]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">空き状況を確認しています…</p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-slate-500">この日は受付をしておりません</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.time}
              type="button"
              disabled={!s.available}
              title={s.reason}
              onClick={() => setTime(s.time)}
              className={`rounded border py-1.5 text-xs ${
                !s.available
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                  : time === s.time
                    ? "border-sage-600 bg-sage-600 font-bold text-white"
                    : "border-slate-200 bg-white"
              }`}
            >
              {s.time}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!time || pending}
        className="w-full rounded-lg bg-sage-600 py-2 text-sm font-medium text-white disabled:bg-slate-300"
      >
        {pending ? "変更中…" : "この日時に変更する"}
      </button>
    </form>
  );
}
