"use client";

import { useActionState } from "react";
import { saveMyProfileAction, type ProfileState } from "@/app/liff/profile-actions";
import { Icon } from "@/components/Icon";

type Values = {
  name: string;
  phone: string;
  postalCode: string;
  address: string;
  buildingName: string;
  layout: string;
  keyHandover: string;
  hasPet: boolean;
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm placeholder:text-slate-400";

/**
 * お客様ご自身が、お名前・ご住所などを登録する欄。
 *
 * 訪問のご予約には住所が要るが、LINEから分かるのはお名前だけ。
 * ここが無いと、はじめての方は訪問のご予約に一切進めない。
 */
export default function ProfileForm({ values }: { values: Values }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    saveMyProfileAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.ok ? (
        <p className="flex items-center gap-1.5 rounded-xl border border-good-100 bg-good-50 px-4 py-3 text-xs font-bold text-good-700">
          <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {state.ok}
        </p>
      ) : null}

      {state.error ? (
        <p className="flex items-start gap-2 rounded-xl border border-bad-100 bg-bad-50 px-4 py-3 text-xs leading-relaxed text-bad-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-bold text-ink">お名前</span>
        <input name="name" defaultValue={values.name} required className={inputCls} />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-ink">お電話番号</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          当日うかがう際に、ご連絡することがあります
        </span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={values.phone}
          placeholder="090-1234-5678"
          className={inputCls}
        />
      </label>

      <div className="rounded-2xl border border-slate-200 bg-ground-warm/50 p-4">
        <p className="text-sm font-bold text-ink">ご住所</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          ご自宅にうかがうメニューをご予約いただくために必要です。
          オンラインのみをご利用の場合は、空のままで大丈夫です。
        </p>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-slate-600">郵便番号</span>
          <input
            name="postalCode"
            inputMode="numeric"
            defaultValue={values.postalCode}
            placeholder="123-4567"
            className={inputCls}
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-slate-600">ご住所</span>
          <input
            name="address"
            defaultValue={values.address}
            placeholder="東京都〇〇区〇〇 1-2-3"
            className={inputCls}
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-slate-600">建物名・お部屋番号</span>
          <input
            name="buildingName"
            defaultValue={values.buildingName}
            placeholder="〇〇マンション 101"
            className={inputCls}
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-slate-600">間取り</span>
          <select name="layout" defaultValue={values.layout} className={inputCls}>
            <option value="">選ばない</option>
            <option value="1LDK">1LDK まで</option>
            <option value="2LDK">2LDK</option>
            <option value="3LDK以上">3LDK 以上</option>
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-bold text-slate-600">当日の鍵について</span>
          <select name="keyHandover" defaultValue={values.keyHandover} className={inputCls}>
            <option value="">選ばない</option>
            <option value="在宅">在宅しています</option>
            <option value="キーボックス">キーボックスをお使いください</option>
            <option value="預かり">鍵をお預けします</option>
          </select>
        </label>

        <label className="mt-3 flex items-center gap-2.5">
          <input type="checkbox" name="hasPet" defaultChecked={values.hasPet} className="h-4 w-4" />
          <span className="text-xs text-slate-600">ペットがいます</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-pill bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-45"
      >
        {pending ? "保存しています…" : "この内容で登録する"}
      </button>
    </form>
  );
}
