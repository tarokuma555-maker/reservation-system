"use client";

import { useEffect, useState, useTransition } from "react";
import { createReservation } from "@/app/actions";

type Option = { id: string; name: string; additionalMinutes: number; additionalPrice: number };

type Props = {
  customerId: string;
  menu: {
    id: string;
    name: string;
    deliveryType: string;
    durationMinutes: number;
    price: number;
  };
  options: Option[];
  dates: string[];
  dateLabels: string[];
};

type SlotResponse = {
  durationMinutes: number;
  layoutAdjustMinutes: number;
  slots: { time: string; available: boolean; reason?: string }[];
};

export default function BookingForm({ customerId, menu, options, dates, dateLabels }: Props) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [date, setDate] = useState(dates[0]);
  const [time, setTime] = useState<string | null>(null);
  const [data, setData] = useState<SlotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const extraMinutes = options
    .filter((o) => selectedOptions.includes(o.id))
    .reduce((s, o) => s + o.additionalMinutes, 0);
  const extraPrice = options
    .filter((o) => selectedOptions.includes(o.id))
    .reduce((s, o) => s + o.additionalPrice, 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTime(null);
    fetch(`/api/slots?date=${date}&menuId=${menu.id}&extraMinutes=${extraMinutes}`)
      .then((r) => r.json())
      .then((d: SlotResponse) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, menu.id, extraMinutes]);

  const totalMinutes = (data?.durationMinutes ?? menu.durationMinutes + extraMinutes);
  const totalPrice = menu.price + extraPrice;
  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

  return (
    <form
      action={(fd) => startTransition(() => void createReservation(fd))}
      className="space-y-5"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="menuId" value={menu.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      {selectedOptions.map((id) => (
        <input key={id} type="hidden" name="optionIds" value={id} />
      ))}

      {menu.deliveryType === "visit" && options.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">オプション（任意）</h2>
          <div className="space-y-2">
            {options.map((o) => {
              const checked = selectedOptions.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${
                    checked ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedOptions((prev) =>
                          prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]
                        )
                      }
                      className="h-4 w-4 accent-[#47705f]"
                    />
                    {o.name}
                  </span>
                  <span className="text-xs text-slate-600">
                    +{o.additionalMinutes}分 / +{yen(o.additionalPrice)}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">日付を選ぶ</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {dates.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`min-w-[68px] shrink-0 rounded-xl border px-3 py-2 text-center text-xs ${
                date === d
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-surface text-slate-700"
              }`}
            >
              {dateLabels[i]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">
          時間を選ぶ
          {data && data.layoutAdjustMinutes > 0 ? (
            <span className="ml-2 text-2xs font-normal text-ocean-600">
              ※お部屋の広さに合わせて +{data.layoutAdjustMinutes}分
            </span>
          ) : null}
        </h2>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">空き状況を確認しています…</p>
        ) : !data || data.slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            この日は受付をしておりません
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {data.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  title={s.reason}
                  onClick={() => setTime(s.time)}
                  className={`rounded-lg border py-2 text-sm ${
                    !s.available
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : time === s.time
                        ? "border-brand-600 bg-brand-600 font-bold text-white"
                        : "border-slate-200 bg-surface text-slate-700 hover:border-brand-300"
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
            {data.slots.every((s) => !s.available) ? (
              <p className="mt-2 text-xs text-slate-500">
                この日は空きがありません。別の日をお選びください。
              </p>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">ご要望（任意）</h2>
        <textarea
          name="customerNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="重点的にお掃除してほしい場所、当日の注意点など"
          className="w-full rounded-xl border border-slate-200 p-3.5 text-sm"
        />
      </section>

      <section className="rounded-card bg-brand-50/60 p-5 text-sm">
        <h2 className="mb-2 font-bold text-ink">ご予約内容</h2>
        <dl className="space-y-1 text-slate-700">
          <Row label="メニュー" value={menu.name} />
          <Row label="ご利用方法" value={menu.deliveryType === "visit" ? "ご自宅にうかがいます" : "オンライン（ビデオ通話）"} />
          <Row label="日時" value={time ? `${date} ${time}〜` : "未選択"} />
          <Row label="所要時間" value={`約${totalMinutes}分`} />
          <Row label="合計金額" value={`${yen(totalPrice)}（税込）`} />
        </dl>
        <p className="mt-3 text-2xs leading-relaxed text-slate-500">
          48時間前まではキャンセル無料です。24〜48時間前のキャンセルは50%、
          24時間前以降はお問い合わせをお願いします。
        </p>
      </section>

      <button
        type="submit"
        disabled={!time || pending}
        className="w-full rounded-pill bg-brand-600 py-3.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:bg-slate-300 disabled:shadow-none"
      >
        {pending ? "送信中…" : time ? "この内容で予約する" : "日時を選んでください"}
      </button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
