"use client";

import { useActionState, useState } from "react";
import {
  createMenuAction,
  updateMenuAction,
  type MenuState,
} from "@/app/admin/menu-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";

export type MenuValues = {
  id?: string;
  name: string;
  category: string;
  description: string;
  deliveryType: string;
  durationMinutes: number;
  price: number;
  sortOrder: number;
  isPublished: boolean;
  isRecurringOnly: boolean;
  isFirstTimeOnly: boolean;
  applyLayoutAdjust: boolean;
};

const EMPTY: MenuValues = {
  name: "",
  category: "",
  description: "",
  deliveryType: "visit",
  durationMinutes: 120,
  price: 11000,
  sortOrder: 0,
  isPublished: true,
  isRecurringOnly: false,
  isFirstTimeOnly: false,
  applyLayoutAdjust: false,
};

const inputCls =
  "mt-1.5 h-[42px] w-full rounded-xl border border-slate-200 bg-surface px-3.5 text-sm leading-5";
/** ご案内の文だけは複数行。高さを決め打ちすると潰れるので分けている。 */
const textCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm leading-5";

/**
 * メニューを足す・直すための入力欄。
 *
 * 新しく足すときも直すときも同じ形にしている。
 * 覚えることを増やさないため。
 */
export default function MenuEditor({
  values,
  categories,
  onDone,
}: {
  values?: MenuValues;
  categories: string[];
  onDone?: () => void;
}) {
  const editing = Boolean(values?.id);
  const [state, formAction] = useActionState<MenuState, FormData>(
    editing ? updateMenuAction : createMenuAction,
    {}
  );
  const v = values ?? EMPTY;

  return (
    <form action={formAction} className="space-y-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormResult ok={state.ok} error={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-bold text-ink">メニューの名前</span>
          <input
            name="name"
            defaultValue={v.name}
            required
            placeholder="おそうじ基本プラン（3時間）"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">分類</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            同じ言葉にすると、お客様の画面でまとまって並びます
          </span>
          <input
            name="category"
            defaultValue={v.category}
            required
            list="menu-categories"
            placeholder="おそうじ"
            className={inputCls}
          />
          <datalist id="menu-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">ご利用方法</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            「うかがう」はご住所のある方だけが選べます
          </span>
          <select name="deliveryType" defaultValue={v.deliveryType} className={inputCls}>
            <option value="visit">ご自宅へうかがう</option>
            <option value="online">オンライン</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">かかる時間</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            この長さで空き時間を計算します
          </span>
          {/*
            いちばん小さい値は「きざみ」の倍数にしておくこと。
            min=1 step=5 と書くと、選べるのが 1,6,11…121 になり、
            121分のような中途半端な数字しか入らなくなる。
          */}
          <span className="flex items-center gap-2">
            <input
              name="durationMinutes"
              type="number"
              min={5}
              step={5}
              list="menu-durations"
              defaultValue={v.durationMinutes}
              required
              className={`${inputCls} !w-32 tabular-nums`}
            />
            <span className="mt-1.5 text-sm text-slate-500">分</span>
          </span>
          <datalist id="menu-durations">
            {[30, 45, 60, 90, 120, 150, 180, 240].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">いただく金額</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            <b>税こみ</b>で入れてください（法律で税こみ表示が決まっています）
          </span>
          <span className="flex items-center gap-2">
            <input
              name="price"
              type="number"
              min={0}
              step={100}
              defaultValue={v.price}
              required
              className={`${inputCls} !w-36 tabular-nums`}
            />
            <span className="mt-1.5 text-sm text-slate-500">円</span>
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-bold text-ink">ご案内の文</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            お客様の画面で、名前の下に出ます
          </span>
          <textarea
            name="description"
            rows={2}
            defaultValue={v.description}
            placeholder="キッチン・お風呂・トイレを中心に、3時間でととのえます。"
            className={textCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-ink">並び順</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            小さい数字が上に出ます
          </span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={v.sortOrder}
            className={`${inputCls} !w-28 tabular-nums`}
          />
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-ground-warm/40 p-4">
        <Check name="isPublished" defaultChecked={v.isPublished} label="お客様の画面に出す" />
        <Check
          name="isFirstTimeOnly"
          defaultChecked={v.isFirstTimeOnly}
          label="はじめての方だけに出す"
        />
        <Check
          name="isRecurringOnly"
          defaultChecked={v.isRecurringOnly}
          label="定期のお客様だけに出す（1回ずつの予約には出しません）"
        />
        <Check
          name="applyLayoutAdjust"
          defaultChecked={v.applyLayoutAdjust}
          label="お部屋の広さに応じて、かかる時間を足す"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton icon="check" pendingLabel="保存しています…">
          {editing ? "この内容で保存する" : "このメニューを追加する"}
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
    </form>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4" />
      <span className="text-xs leading-relaxed text-slate-700">{label}</span>
    </label>
  );
}

/** 一覧の行から開く、折りたたみ式の編集欄 */
export function MenuEditorToggle({
  values,
  categories,
}: {
  values: MenuValues;
  categories: string[];
}) {
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
      <MenuEditor values={values} categories={categories} onDone={() => setOpen(false)} />
    </div>
  );
}
