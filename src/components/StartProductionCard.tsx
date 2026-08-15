"use client";

import { useActionState, useState } from "react";
import { clearDemoDataAction, type ResetState } from "@/app/reset-actions";
import { Icon } from "@/components/Icon";
import type { DemoDataCounts } from "@/lib/reset";

/**
 * デモのデータを消して本番に切り替える操作。
 *
 * 取り消せないので、
 *  1. 何が消えて何が残るのかを、押す前に全部見せる
 *  2. 「消す準備をする」を押してから、確認の言葉を打ってもらう
 * の二段にしている。
 */
export default function StartProductionCard({
  counts,
  confirmPhrase,
}: {
  counts: DemoDataCounts;
  confirmPhrase: string;
}) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    clearDemoDataAction,
    {}
  );
  const [armed, setArmed] = useState(false);

  if (state.ok) {
    return (
      <div className="flex gap-3 rounded-card border border-good-100 bg-good-50 px-5 py-4">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good-600" strokeWidth={2.6} />
        <div className="text-xs leading-relaxed text-good-700">
          <p className="font-bold">{state.ok}</p>
          <p className="mt-1.5 text-slate-600">
            このあとは、実際のお客様がLINEから予約されると、ここに増えていきます。
            料金やお店の名前がまだ仮のままなら、上の設定を書きかえてください。
          </p>
        </div>
      </div>
    );
  }

  const rows: { label: string; n: number }[] = [
    { label: "お客様", n: counts.customers },
    { label: "ご予約", n: counts.reservations },
    { label: "定期のお客様", n: counts.recurringRules },
    { label: "出した領収書", n: counts.invoices },
    { label: "帳簿の記録", n: counts.journalEntries },
    { label: "経費", n: counts.expenses },
    { label: "しまってある書類", n: counts.documents },
  ];

  return (
    <div className="rounded-card border border-bad-100 bg-bad-50/40 p-5">
      <div className="flex gap-3">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">デモのデータを消して、本番として使いはじめる</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            いま入っているのは、動きを見ていただくために作った架空のお客様とご予約です。
            実際にお使いになる前に、ここで消してまっさらにします。
            <b className="text-bad-700">消したものは元に戻せません。</b>
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-bad-100 bg-surface p-4">
          <p className="text-2xs font-bold tracking-wide text-bad-700">消えるもの</p>
          <ul className="mt-2 space-y-1">
            {rows.map((r) => (
              <li key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-slate-600">{r.label}</span>
                <span className="font-bold tabular-nums text-ink">{r.n}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-4">
          <p className="text-2xs font-bold tracking-wide text-good-700">残るもの</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>お店の設定（名前・料金の決まり・税の設定）</li>
            <li>営業時間とお休みの日</li>
            <li>管理画面にログインできる人</li>
            <li>LINEとのつながり・出したメニュー</li>
            <li>料金メニュー（下で選べば消せます）</li>
          </ul>
        </div>
      </div>

      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-pill border border-bad-100 bg-surface px-5 py-2.5 text-xs font-bold text-bad-700 transition hover:bg-bad-50"
        >
          <Icon name="alert" className="h-3.5 w-3.5" />
          消す準備をする
        </button>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          {state.error ? (
            <div className="flex gap-2.5 rounded-xl border border-bad-100 bg-bad-50 px-4 py-3">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
              <p className="text-xs leading-relaxed text-bad-700">{state.error}</p>
            </div>
          ) : null}

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-surface px-4 py-3">
            <input type="checkbox" name="deleteMenus" className="mt-0.5 h-4 w-4" />
            <span className="text-xs leading-relaxed text-slate-600">
              料金メニュー（{counts.menus}件）も消す
              <span className="mt-0.5 block text-2xs text-slate-500">
                チェックしないと、いまの仮のメニューが残ります。
                名前と金額を書きかえて使うほうが早い場合は、そのままにしてください。
              </span>
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-ink">
              確認のため、
              <span className="mx-1 rounded bg-bad-50 px-1.5 py-0.5 font-mono text-bad-700">
                {confirmPhrase}
              </span>
              と打ち込んでください
            </span>
            <input
              name="confirm"
              autoComplete="off"
              placeholder={confirmPhrase}
              className="w-full rounded-xl border border-bad-100 bg-surface px-3.5 py-2.5 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-pill bg-bad-600 px-6 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-bad-700 disabled:opacity-45"
            >
              <Icon name="close" className="h-4 w-4" />
              {pending ? "消しています…" : "消して、本番をはじめる"}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="text-xs font-bold text-slate-500 transition hover:text-slate-700"
            >
              やめる
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
