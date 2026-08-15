"use client";

import { useActionState, useState } from "react";
import { connectLineAction, type ConnectState } from "@/app/connect-actions";
import { Icon } from "@/components/Icon";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 font-mono text-xs placeholder:font-sans placeholder:text-slate-400";

/**
 * LINEの合いことばを貼り付ける欄。
 *
 * すでにつながっている場合は、まちがえて消してしまわないよう
 * 「つなぎ替える」を押してから入力欄が出る形にしている。
 */
export default function LineConnectForm({
  connected,
  currentLabel,
  currentLiffId,
}: {
  connected: boolean;
  currentLabel: string | null;
  currentLiffId: string | null;
}) {
  const [state, formAction, pending] = useActionState<ConnectState, FormData>(
    connectLineAction,
    {}
  );
  const [open, setOpen] = useState(!connected);

  if (connected && !open) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good-100 bg-good-50 px-4 py-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-good-700">
              <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
              {currentLabel ?? "LINE"} につながっています
            </p>
            <p className="mt-0.5 text-2xs text-slate-600">
              合いことばは安全のため画面に出していません。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-pill border border-slate-200 bg-surface px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            別のアカウントにつなぎ替える
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          あとからお客さま側で公式アカウントを作られた場合も、ここから貼り替えるだけで
          乗り換えられます。ご予約や帳簿はそのまま残ります。
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.ok ? (
        <div className="flex gap-2.5 rounded-card border border-good-100 bg-good-50 px-4 py-3">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good-600" strokeWidth={2.6} />
          <div className="text-xs leading-relaxed text-good-700">
            <p className="font-bold">{state.ok}</p>
            {state.detail ? <p className="mt-0.5 text-slate-600">{state.detail}</p> : null}
          </div>
        </div>
      ) : null}

      {state.error ? (
        <div className="flex gap-2.5 rounded-card border border-bad-100 bg-bad-50 px-4 py-3">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-xs leading-relaxed text-bad-700">{state.error}</p>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
          チャネルアクセストークン（長いほうの文字列）
        </span>
        <textarea
          name="accessToken"
          rows={3}
          required
          placeholder="ここに貼り付けてください"
          className={inputCls}
        />
        <span className="mt-1 block text-2xs text-slate-500">
          200文字ほどある長い文字列です。前後に空白が入っても、こちらで取り除きます。
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
          チャネルシークレット（短いほうの文字列）
        </span>
        <input
          name="channelSecret"
          required
          placeholder="ここに貼り付けてください"
          className={inputCls}
        />
        <span className="mt-1 block text-2xs text-slate-500">
          32文字ほどの文字列です。お客様からのご連絡が本物かを確かめるのに使います。
        </span>
      </label>

      {currentLiffId ? (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          いま入っているLIFF ID（{currentLiffId}）はそのまま引き継ぎます。
          変えたいときは手順4で入れ直してください。
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-45"
        >
          <Icon name="link" className="h-4 w-4" />
          {pending ? "つないでいます…" : connected ? "このアカウントに切り替える" : "つなぐ"}
        </button>
        {connected ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-bold text-slate-500 transition hover:text-slate-700"
          >
            やめる
          </button>
        ) : null}
      </div>

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
        <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        押すと、その場でLINEに問い合わせて、本当につながるかを確かめます。
        まちがっていれば保存されないので、気軽におためしください。
      </p>
    </form>
  );
}
