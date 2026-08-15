"use client";

import { useActionState, useState } from "react";
import { saveOptionAction, deleteOptionAction, type MenuState } from "@/app/admin/menu-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";

type OptionValues = {
  id?: string;
  name: string;
  additionalMinutes: number;
  additionalPrice: number;
};

const inputCls = "w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm";

/** 追加でえらべるもの、1件ぶんの入力欄。そのまま直して保存できる。 */
export default function OptionEditor({
  values,
  onDone,
}: {
  values?: OptionValues;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<MenuState, FormData>(saveOptionAction, {});
  const [delState, delAction] = useActionState<MenuState, FormData>(deleteOptionAction, {});
  const v = values ?? { name: "", additionalMinutes: 0, additionalPrice: 0 };

  return (
    <div className="space-y-3">
      <FormResult ok={state.ok ?? delState.ok} error={state.error ?? delState.error} />

      <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

        <label className="block">
          <span className="text-2xs font-bold text-slate-600">内容</span>
          <input
            name="name"
            defaultValue={v.name}
            required
            placeholder="換気扇クリーニング"
            className={`mt-1 ${inputCls}`}
          />
        </label>

        <label className="block">
          <span className="text-2xs font-bold text-slate-600">増える時間（分）</span>
          <input
            name="additionalMinutes"
            type="number"
            min={0}
            step={5}
            defaultValue={v.additionalMinutes}
            className={`mt-1 ${inputCls} !w-32 tabular-nums`}
          />
        </label>

        <label className="block">
          <span className="text-2xs font-bold text-slate-600">増える金額（税こみ）</span>
          <input
            name="additionalPrice"
            type="number"
            min={0}
            step={100}
            defaultValue={v.additionalPrice}
            className={`mt-1 ${inputCls} !w-36 tabular-nums`}
          />
        </label>

        <div className="flex items-end gap-2">
          <SubmitButton size="sm" icon="check" pendingLabel="保存しています…" className="px-5 py-2.5">
            保存
          </SubmitButton>
          {onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="pb-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              とじる
            </button>
          ) : null}
        </div>
      </form>

      {values?.id ? (
        <form action={delAction}>
          <input type="hidden" name="id" value={values.id} />
          <SubmitButton
            variant="danger"
            size="sm"
            icon="trash"
            pendingLabel="消しています…"
            confirm={`「${v.name}」を消します。よろしいですか？`}
          >
            これを消す
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function AddOptionPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-pill border border-slate-200 bg-surface px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" />
        追加でえらべるものを足す
      </button>
    );
  }

  return (
    <div className="rounded-card border border-brand-200 bg-brand-50/40 p-5">
      <p className="mb-3 text-sm font-bold text-ink">追加でえらべるものを足す</p>
      <OptionEditor onDone={() => setOpen(false)} />
    </div>
  );
}
