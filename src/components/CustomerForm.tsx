"use client";

import { useActionState, useState } from "react";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerState,
} from "@/app/admin/customer-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";

export type CustomerValues = {
  id?: string;
  name: string;
  nameKana: string;
  phone: string;
  email: string;
  postalCode: string;
  address: string;
  buildingName: string;
  layout: string;
  keyHandover: string;
  companyName: string;
  hasPet: boolean;
  note: string;
};

const EMPTY: CustomerValues = {
  name: "",
  nameKana: "",
  phone: "",
  email: "",
  postalCode: "",
  address: "",
  buildingName: "",
  layout: "",
  keyHandover: "",
  companyName: "",
  hasPet: false,
  note: "",
};

const inputCls =
  "mt-1.5 h-[42px] w-full rounded-xl border border-slate-200 bg-surface px-3.5 text-sm leading-5 placeholder:text-slate-400";

/** 電話や紹介のお客様を、こちらから登録・修正する欄 */
export default function CustomerForm({
  values,
  onDone,
}: {
  values?: CustomerValues;
  onDone?: () => void;
}) {
  const editing = Boolean(values?.id);
  const [state, formAction] = useActionState<CustomerState, FormData>(
    editing ? updateCustomerAction : createCustomerAction,
    {}
  );
  const v = values ?? EMPTY;

  return (
    <form action={formAction} className="space-y-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormResult ok={state.ok} error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold text-ink">お名前</span>
          <input name="name" defaultValue={v.name} required className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-ink">ふりがな</span>
          <input name="nameKana" defaultValue={v.nameKana} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-ink">お電話番号</span>
          <input
            name="phone"
            type="tel"
            defaultValue={v.phone}
            placeholder="090-1234-5678"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-ink">
            会社名
            <span className="ml-1.5 font-normal text-slate-400">（法人のお客様のみ）</span>
          </span>
          <input name="companyName" defaultValue={v.companyName} className={inputCls} />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-ground-warm/40 p-4">
        <p className="text-sm font-bold text-ink">ご住所</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          うかがうメニューのご予約には必要です。オンラインだけの方は空で構いません。
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">郵便番号</span>
            <input
              name="postalCode"
              defaultValue={v.postalCode}
              placeholder="123-4567"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">ご住所</span>
            <input
              name="address"
              defaultValue={v.address}
              placeholder="東京都中央区銀座1-2-3"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">建物名・お部屋番号</span>
            <input name="buildingName" defaultValue={v.buildingName} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">間取り</span>
            <select name="layout" defaultValue={v.layout} className={inputCls}>
              <option value="">選ばない</option>
              <option value="1LDK">1LDK まで</option>
              <option value="2LDK">2LDK</option>
              <option value="3LDK以上">3LDK 以上</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">当日の鍵について</span>
            <select name="keyHandover" defaultValue={v.keyHandover} className={inputCls}>
              <option value="">選ばない</option>
              <option value="在宅">在宅されています</option>
              <option value="キーボックス">キーボックス</option>
              <option value="預かり">鍵をお預かり</option>
            </select>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2.5">
          <input type="checkbox" name="hasPet" defaultChecked={v.hasPet} className="h-4 w-4" />
          <span className="text-xs text-slate-600">ペットがいます</span>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-bold text-ink">メモ</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          お客様には見えません。苦手なこと、紹介元など
        </span>
        <input name="note" defaultValue={v.note} className={inputCls} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton icon="check" pendingLabel="保存しています…">
          {editing ? "この内容で保存する" : "このお客様を登録する"}
        </SubmitButton>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="text-xs font-bold text-slate-500 transition hover:text-slate-700"
          >
            とじる
          </button>
        ) : null}
      </div>

      {!editing ? (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          ここで登録した方はLINEをお持ちでないため、自動のお知らせは届きません。
          あとからLINEで友だち追加された場合は、別のお客様として登録されます。
        </p>
      ) : null}
    </form>
  );
}

/** 一覧の行から開く、折りたたみ式の編集欄 */
export function CustomerEditToggle({ values }: { values: CustomerValues }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-pill border border-slate-200 bg-surface px-3.5 py-1.5 text-2xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
      >
        <Icon name="edit" className="h-3.5 w-3.5" />
        直す
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <CustomerForm values={values} onDone={() => setOpen(false)} />
    </div>
  );
}

/** 「新しく登録」を押したときだけ欄を出す */
export function AddCustomerPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" />
        お客様を新しく登録する
      </button>
    );
  }

  return (
    <div className="rounded-card border border-brand-200 bg-brand-50/40 p-5">
      <p className="mb-4 text-sm font-bold text-ink">お客様を新しく登録する</p>
      <CustomerForm onDone={() => setOpen(false)} />
    </div>
  );
}
