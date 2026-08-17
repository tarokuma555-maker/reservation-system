"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createReservationByOwnerAction, type BookingState } from "@/app/admin/booking-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Field, inputClass } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Customer = { id: string; name: string; companyName: string | null; hasAddress: boolean };
type Menu = { id: string; name: string; deliveryType: string; durationMinutes: number; price: number };
type Option = { id: string; name: string; additionalMinutes: number; additionalPrice: number };

/**
 * 電話や紹介で受けたご予約を入れる欄。
 *
 * お客様側の予約画面と違い、空いている時間だけを出すことはしない。
 * 「今日の夕方に頼まれた」を断れないと実務で使えないため、
 * 時間は自由に入れられるようにし、重なりだけを知らせる。
 */
export default function OwnerBookingForm({
  customers,
  menus,
  options,
  today,
}: {
  customers: Customer[];
  menus: Menu[];
  options: Option[];
  today: string;
}) {
  const [state, formAction] = useActionState<BookingState, FormData>(
    createReservationByOwnerAction,
    {}
  );
  const [menuId, setMenuId] = useState(menus[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");

  const menu = menus.find((m) => m.id === menuId);
  const customer = customers.find((c) => c.id === customerId);
  const needsAddress = menu?.deliveryType === "visit" && customer && !customer.hasAddress;

  if (customers.length === 0 || menus.length === 0) {
    return (
      <div className="flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3.5">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
        <p className="text-xs leading-relaxed text-warn-700">
          {customers.length === 0 ? (
            <>
              <b>お客様が1件も登録されていません。</b>
              <br />
              先に{" "}
              <Link href="/admin/customers" className="font-bold underline">
                お客様
              </Link>{" "}
              から登録してください。
            </>
          ) : (
            <>
              <b>メニューが1件もありません。</b>
              <br />
              先に{" "}
              <Link href="/admin/menus" className="font-bold underline">
                メニューと料金
              </Link>{" "}
              から登録してください。
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormResult ok={state.ok} error={state.error} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="どのお客様" className="min-w-[220px] flex-1">
          <select
            name="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={inputClass}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName ? `${c.companyName}（${c.name}）` : c.name}
                {c.hasAddress ? "" : "・住所なし"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="メニュー" className="min-w-[240px] flex-1">
          <select
            name="menuId"
            value={menuId}
            onChange={(e) => setMenuId(e.target.value)}
            className={inputClass}
          >
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.deliveryType === "visit" ? "うかがう" : "オンライン"}／{m.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {needsAddress ? (
        <p className="flex items-start gap-2 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3 text-xs leading-relaxed text-warn-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            このお客様はご住所が未登録です。うかがうメニューは登録しないと入れられません。
            <Link href="/admin/customers" className="ml-1 font-bold underline">
              お客様の情報を直す
            </Link>
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="日にち">
          <input type="date" name="date" defaultValue={today} className={`${inputClass} !w-44`} />
        </Field>
        <Field label="はじまる時間">
          <input
            type="time"
            name="time"
            defaultValue="10:00"
            step={900}
            className={`${inputClass} !w-32`}
          />
        </Field>
        {menu ? (
          <p className="pb-2.5 text-xs text-slate-500">
            かかる時間 約{menu.durationMinutes}分 ／ {menu.price.toLocaleString()}円（税込）
          </p>
        ) : null}
      </div>

      {options.length > 0 ? (
        <div>
          <p className="mb-1.5 text-2xs font-bold tracking-wide text-slate-600">
            追加でえらぶもの
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label
                key={o.id}
                className="inline-flex items-center gap-2 rounded-pill border border-slate-200 bg-surface px-3.5 py-2"
              >
                <input type="checkbox" name="optionIds" value={o.id} className="h-3.5 w-3.5" />
                <span className="text-xs text-slate-700">
                  {o.name}
                  <span className="ml-1 text-slate-500">
                    +{o.additionalMinutes}分 / +{o.additionalPrice.toLocaleString()}円
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="メモ" hint="当日の注意点など。お客様には見えません">
        <input name="note" placeholder="お電話でのご依頼。鍵は管理人室" className={inputClass} />
      </Field>

      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-ground-warm/40 px-4 py-3">
        <input type="checkbox" name="force" className="mt-0.5 h-4 w-4" />
        <span className="text-xs leading-relaxed text-slate-600">
          重なっても入れる
          <span className="mt-0.5 block text-2xs text-slate-500">
            ふだんは、他のご予約と重なっていると止めます。
            承知のうえで入れる場合だけチェックしてください。
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton icon="check" pendingLabel="登録しています…">
          このご予約を入れる
        </SubmitButton>
        {state.reservationId ? (
          <Link
            href={`/admin/reservations/${state.reservationId}`}
            className="text-xs font-bold text-brand-700 underline"
          >
            入れたご予約を見る
          </Link>
        ) : null}
      </div>

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
        <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        LINEをお使いのお客様には、登録と同時にお知らせが届きます。
        お使いでない方には届きませんが、記録は残ります。カレンダーへの書き出しはどちらも行われます。
      </p>
    </form>
  );
}
