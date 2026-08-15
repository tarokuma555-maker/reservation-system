"use client";

import { useActionState } from "react";
import { saveLiffIdAction, type ConnectState } from "@/app/connect-actions";
import { Icon } from "@/components/Icon";

/**
 * LIFF IDだけを入れる欄。
 *
 * 合いことばと一緒の欄にしてしまうと、LIFF IDを足すためだけに
 * 長いトークンを取りに戻ることになる。ここだけ独立させている。
 */
export default function LiffIdForm({ current }: { current: string | null }) {
  const [state, formAction, pending] = useActionState<ConnectState, FormData>(saveLiffIdAction, {});

  return (
    <form action={formAction} className="space-y-3">
      {state.ok ? (
        <p className="inline-flex items-center gap-1.5 rounded-card border border-good-100 bg-good-50 px-4 py-2.5 text-xs font-bold text-good-700">
          <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
          {state.ok}
        </p>
      ) : null}

      {state.error ? (
        <div className="flex gap-2.5 rounded-card border border-bad-100 bg-bad-50 px-4 py-3">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-xs leading-relaxed text-bad-700">{state.error}</p>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
          LIFF ID
        </span>
        <input
          name="liffId"
          defaultValue={current ?? ""}
          required
          placeholder="1234567890-abcdefgh"
          className="w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 font-mono text-xs placeholder:font-sans placeholder:text-slate-400"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-45"
        >
          <Icon name="link" className="h-4 w-4" />
          {pending ? "つないでいます…" : current ? "入れ直す" : "つなぐ"}
        </button>
        {current ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-good-700">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
            いま入っています
          </span>
        ) : null}
      </div>

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
        <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        合いことばはそのままで、ここだけ入れ替わります。貼り直す必要はありません。
      </p>
    </form>
  );
}
