import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { Howto, SetupStep } from "@/components/SetupStep";
import CopyField from "@/components/CopyField";
import { googleRedirectUri } from "@/lib/google-oauth";
import { disconnectGoogleAction, startGoogleConnectAction } from "@/app/connect-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 font-mono text-xs placeholder:font-sans placeholder:text-slate-400";

/**
 * Googleカレンダーとつなぐところ。
 *
 * デモではリフレッシュトークンを手作業で取る必要があったが、
 * ここでは「つなぐ」を押してGoogleの確認画面で許可するだけで終わる。
 */
export default function GoogleConnectCard({
  connected,
  status,
  lastError,
  connectedAt,
  fromEnv,
}: {
  connected: boolean;
  status: "connected" | "error" | "disconnected";
  lastError: string | null;
  connectedAt: Date | null;
  fromEnv: boolean;
}) {
  const redirectUri = googleRedirectUri();

  if (connected && status !== "error") {
    return (
      <SetupStep
        n={1}
        title="Googleカレンダーとつなぐ"
        summary="つながっています。ご予約は自動でカレンダーにうつります。"
        done
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good-100 bg-good-50 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-good-700">
              <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
              つながっています
              {connectedAt ? (
                <span className="font-normal text-slate-600">
                  （{connectedAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} から）
                </span>
              ) : null}
            </p>
            {!fromEnv ? (
              <form action={disconnectGoogleAction}>
                <Button type="submit" variant="danger" size="sm">
                  <Icon name="close" className="h-3.5 w-3.5" />
                  つながりを解除する
                </Button>
              </form>
            ) : null}
          </div>
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            Google側で許可を取り消された場合は、この画面に「切れています」と出ます。
            そのときは同じ手順でつなぎ直してください。
          </p>
        </div>
      </SetupStep>
    );
  }

  return (
    <SetupStep
      n={1}
      title="Googleカレンダーとつなぐ"
      summary="ご予約をスマホのカレンダーからも見られるようにします。15分ほどの作業です。"
      done={false}
    >
      <div className="space-y-5">
        {status === "error" ? (
          <div className="flex gap-2.5 rounded-card border border-bad-100 bg-bad-50 px-4 py-3">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
            <div className="text-xs leading-relaxed text-bad-700">
              <p className="font-bold">つながりが切れています</p>
              {lastError ? <p className="mt-0.5">{lastError}</p> : null}
              <p className="mt-0.5 text-slate-600">下の手順で、もう一度つないでください。</p>
            </div>
          </div>
        ) : null}

        <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold text-slate-700">
            <Icon name="chevronRight" className="h-3.5 w-3.5 transition group-open:rotate-90" />
            2つの文字列は、どこで手に入りますか？
          </summary>
          <div className="space-y-3 border-t border-slate-200 px-4 py-4">
            <Howto
              steps={[
                <>
                  パソコンで{" "}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-bold text-brand-700 underline"
                  >
                    Google Cloud
                  </a>{" "}
                  を開き、ふだんお使いのGoogleアカウントでログインします
                </>,
                <>
                  上の「プロジェクトを選択」から<b>新しいプロジェクトを作ります</b>
                  （名前は「予約システム」などで結構です）
                </>,
                <>
                  検索欄に「Google Calendar API」と入れて開き、<b>「有効にする」</b>を押します
                </>,
                <>
                  左の<b>「OAuth同意画面」</b>で、種類を「外部」にして、
                  アプリ名とご自身のメールアドレスを入れて保存します
                </>,
                <>
                  同じ画面の<b>「対象」</b>で、ご自身のメールアドレスを
                  <b>「テストユーザー」</b>に追加します
                </>,
                <>
                  左の<b>「認証情報」</b>→「認証情報を作成」→
                  <b>「OAuth クライアント ID」</b>を選び、種類は「ウェブアプリケーション」にします
                </>,
                <>
                  <b>「承認済みのリダイレクト URI」</b>に、下の文字列をそのまま貼り付けます
                </>,
                <>できあがった2つの文字列を、下の欄に貼り付けます</>,
              ]}
            />
            <CopyField label="リダイレクトURI（そのまま貼り付けてください）" value={redirectUri} />
          </div>
        </details>

        <form action={startGoogleConnectAction} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
              クライアントID
            </span>
            <input
              name="clientId"
              required
              placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
              クライアントシークレット
            </span>
            <input name="clientSecret" required placeholder="GOCSPX-…" className={inputCls} />
          </label>

          <Button type="submit">
            <Icon name="link" className="h-4 w-4" />
            Googleの確認画面へすすむ
          </Button>

          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            押すとGoogleの画面に移ります。「このアプリにカレンダーを見せてもいいですか」と
            聞かれるので「続行」を押すと、ここに戻ってきて完了です。
            お願いするのは<b>カレンダーの読み書きだけ</b>で、メールや連絡先には触れません。
          </p>
        </form>
      </div>
    </SetupStep>
  );
}
