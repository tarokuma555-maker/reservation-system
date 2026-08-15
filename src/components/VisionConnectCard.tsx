"use client";

import { useActionState, useState } from "react";
import {
  connectVisionAction,
  disconnectVisionAction,
  recheckVisionAction,
  type ConnectState,
} from "@/app/connect-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { Icon } from "@/components/Icon";

/**
 * レシートの読み取りをつなぐ欄。
 *
 * つなぐまでは、用意したレシートの文面で動く（お試し）。
 * つなぐと、撮った写真をそのまま読むようになる。
 */
export default function VisionConnectCard({
  connected,
  label,
  lastError,
}: {
  connected: boolean;
  label: string | null;
  lastError: string | null;
}) {
  const [state, formAction] = useActionState<ConnectState, FormData>(connectVisionAction, {});
  const [recheck, recheckAction] = useActionState<ConnectState, FormData>(recheckVisionAction, {});
  const [open, setOpen] = useState(!connected);

  if (connected && !open) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good-100 bg-good-50 px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-good-700">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
            写真からそのまま読み取ります{label ? `（${label}）` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <form action={recheckAction}>
              <SubmitButton variant="secondary" size="sm" icon="refresh" pendingLabel="確かめています…">
                いま読み取れるか確かめる
              </SubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-pill border border-slate-200 bg-surface px-4 py-1.5 text-2xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              入れ替える
            </button>
          </div>
        </div>

        <FormResult ok={recheck.ok} error={recheck.error ?? lastError ?? undefined} />

        <form action={disconnectVisionAction}>
          <SubmitButton variant="danger" size="sm" icon="close" pendingLabel="外しています…">
            つながりを解除する
          </SubmitButton>
        </form>
        <p className="text-2xs leading-relaxed text-slate-500">
          解除すると、用意したレシートの文面で動く状態に戻ります。入れた経費はそのまま残ります。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold text-slate-700">
          <Icon name="chevronRight" className="h-3.5 w-3.5 transition group-open:rotate-90" />
          その合いことばは、どこで作りますか？
        </summary>
        <div className="space-y-2.5 border-t border-slate-200 px-4 py-4 text-xs leading-relaxed text-slate-700">
          <p>
            Googleの「Cloud Vision」という読み取りの仕組みを使います。
            はじめに1度だけ、合いことば（APIキー）を作ります。
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>
              パソコンで{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-bold text-brand-700 underline"
              >
                Google Cloud
              </a>{" "}
              を開き、カレンダーのときと同じアカウントでログインします
            </li>
            <li>上の方でプロジェクトを選びます（無ければ新しく作ります）</li>
            <li>
              検索欄に <b>Cloud Vision API</b> と入れて開き、<b>「有効にする」</b>を押します
            </li>
            <li>
              左のメニューから<b>「APIとサービス」→「認証情報」</b>を開きます
            </li>
            <li>
              上の<b>「認証情報を作成」→「APIキー」</b>を押すと、文字列が出てきます
            </li>
            <li>その文字列を写して、下の欄に貼り付けます</li>
          </ol>
          <div className="flex gap-2.5 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn-600" />
            <p className="text-2xs leading-relaxed text-warn-700">
              読み取りは<b>月1,000枚まで無料</b>で、それを超えると1,000枚あたり数百円ほどかかります。
              レシートを1日10枚撮っても月300枚ほどなので、ふつうは無料の範囲におさまります。
              心配な場合は、Google側で上限金額を決めておくこともできます。
            </p>
          </div>
        </div>
      </details>

      <form action={formAction} className="space-y-3">
        <FormResult ok={state.ok} error={state.error} />

        <label className="block">
          <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
            合いことば（APIキー）
          </span>
          <input
            name="apiKey"
            required
            placeholder="ここに貼り付けてください"
            className="h-[42px] w-full rounded-xl border border-slate-200 bg-surface px-3.5 font-mono text-xs leading-5 placeholder:font-sans placeholder:text-slate-400"
          />
          <span className="mt-1 block text-2xs text-slate-500">
            「AIza」ではじまる40文字ほどの文字列です。人に見せないでください。
            保存するときは暗号をかけ、画面にも出しません。
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton icon="link" pendingLabel="確かめています…">
            つなぐ
          </SubmitButton>
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
          押すと、その場でGoogleに問い合わせて、本当に読み取れるかを確かめます。
          まちがっていれば保存されないので、気軽におためしください。
        </p>
      </form>
    </div>
  );
}
