import { prisma } from "@/lib/db";
import { getLineConnection, getLineCredentials } from "@/lib/line";
import { isEncryptionReady } from "@/lib/crypto";
import { LIFF_IDENTITY_READY } from "@/lib/readiness";
import { presetFor } from "@/lib/richmenu-presets";
import { Button, Card, SectionTitle } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { SetupProgress, SetupStep, Howto } from "@/components/SetupStep";
import CopyField from "@/components/CopyField";
import LineConnectForm from "@/components/LineConnectForm";
import LiffIdForm from "@/components/LiffIdForm";
import { disconnectLineAction, recheckLineAction } from "@/app/connect-actions";
import { publishRichMenuAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/** お客様に自動で届くおしらせ。何がいつ届くかを、ひと目で分かるようにする。 */
const NOTIFICATIONS: { icon: IconName; when: string; what: string }[] = [
  { icon: "calendarCheck", when: "ご予約をいただいたとき", what: "承りましたのご連絡" },
  { icon: "edit", when: "日時を変えたとき", what: "変更後の日時のご案内" },
  { icon: "close", when: "お取り消しになったとき", what: "取り消しのご連絡とキャンセル料" },
  { icon: "skip", when: "定期のお客様が1回お休みされたとき", what: "承りましたのご連絡" },
  { icon: "bell", when: "ご予約の前日", what: "明日おうかがいしますのおしらせ" },
  { icon: "online", when: "オンラインが始まる少し前", what: "ビデオ通話のご案内" },
  { icon: "check", when: "お仕事が終わったとき", what: "ありがとうございましたのお礼" },
  { icon: "receipt", when: "領収書を出したとき", what: "領収書のお届け" },
  { icon: "user", when: "友だち追加されたとき", what: "はじめましてのごあいさつ" },
];

export default async function LineSetupPage() {
  const [line, credentials, richMenus] = await Promise.all([
    getLineConnection(),
    getLineCredentials(),
    prisma.richMenu.findMany({ orderBy: { target: "desc" } }),
  ]);

  const baseUrl = (process.env.APP_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const webhookUrl = `${baseUrl}/api/line/webhook`;
  const liffUrl = `${baseUrl}/liff`;

  const connected = line.connected;
  const hasLiff = Boolean(credentials?.liffId);
  const menuPublished = richMenus.some((m) => m.isPublished);
  const encryptionReady = isEncryptionReady();

  return (
    <div className="space-y-5">
      <SetupProgress
        steps={[
          { label: "つなぐ", done: connected },
          { label: "受け口を伝える", done: connected },
          { label: "予約画面をつなぐ", done: hasLiff },
          ...(LIFF_IDENTITY_READY ? [{ label: "メニューを出す", done: menuPublished }] : []),
        ]}
      />

      {!encryptionReady ? (
        <div className="flex gap-3 rounded-card border border-bad-100 bg-bad-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-xs leading-relaxed text-bad-700">
            合いことばを安全にしまうための鍵がまだ用意できていません。
            この状態では画面からつなぐことができないので、お知らせください。こちらで用意します。
          </p>
        </div>
      ) : null}

      {line.status === "error" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-bad-100 bg-bad-50 px-4 py-3.5">
          <div className="flex min-w-0 gap-3">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
            <div className="min-w-0 text-xs leading-relaxed text-bad-700">
              <p className="font-bold">LINEとのつながりが切れています</p>
              <p className="mt-0.5">
                いまはおしらせが届きません。{line.lastError ? `（${line.lastError}）` : ""}
              </p>
            </div>
          </div>
          <form action={recheckLineAction}>
            <Button type="submit" variant="secondary" size="sm">
              <Icon name="refresh" className="h-3.5 w-3.5" />
              もう一度確かめる
            </Button>
          </form>
        </div>
      ) : null}

      {/* ---------------- 手順1 ---------------- */}
      <SetupStep
        n={1}
        title="LINEとつなぐ"
        summary="LINEから2つの文字列を写してきて、下に貼り付けます。10分ほどの作業です。"
        done={connected}
      >
        <div className="space-y-5">
          <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold text-slate-700">
              <Icon name="chevronRight" className="h-3.5 w-3.5 transition group-open:rotate-90" />
              その2つの文字列は、どこにありますか？
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <Howto
                steps={[
                  <>
                    パソコンで{" "}
                    <a
                      href="https://developers.line.biz/console/"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-bold text-brand-700 underline"
                    >
                      LINE Developers
                    </a>{" "}
                    を開き、ふだんお使いのLINEアカウントでログインします
                  </>,
                  <>
                    お店の公式アカウントを選び、<b>「Messaging API設定」</b>のタブを開きます
                  </>,
                  <>
                    いちばん下の<b>「チャネルアクセストークン（長期）」</b>で「発行」を押し、
                    出てきた長い文字列を写します
                  </>,
                  <>
                    <b>「チャネル基本設定」</b>のタブに移り、<b>「チャネルシークレット」</b>
                    の文字列を写します
                  </>,
                  <>下の欄に、それぞれ貼り付けます</>,
                ]}
              />
              <p className="mt-3 flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
                <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                この2つは、お店のLINEを操作するための合いことばです。人に見せないでください。
                保存するときは暗号をかけ、画面にも出しません。
              </p>
            </div>
          </details>

          <LineConnectForm
            connected={connected}
            currentLabel={line.label}
            currentLiffId={credentials?.liffId ?? null}
          />

          {connected && !line.fromEnv ? (
            <form action={disconnectLineAction} className="border-t border-slate-100 pt-4">
              <Button type="submit" variant="danger" size="sm">
                <Icon name="close" className="h-3.5 w-3.5" />
                つながりを解除する
              </Button>
              <p className="mt-2 text-2xs leading-relaxed text-slate-500">
                解除すると、お客様におしらせが届かなくなります。ご予約や帳簿はそのまま残ります。
              </p>
            </form>
          ) : null}
        </div>
      </SetupStep>

      {/* ---------------- 手順2 ---------------- */}
      <SetupStep
        n={2}
        title="お客様からのご連絡の受け口を、LINEに伝える"
        summary="お客様が友だち追加したときや、メッセージを送ってくださったときに、それがこちらに届くようにします。"
        done={connected}
      >
        <div className="space-y-4">
          <CopyField label="この文字列を、LINE側に貼り付けます" value={webhookUrl} />

          <Howto
            steps={[
              <>
                LINE Developers の<b>「Messaging API設定」</b>を開きます
              </>,
              <>
                <b>「Webhook URL」</b>の「編集」を押し、上の文字列を貼って「更新」します
              </>,
              <>
                すぐ下の<b>「Webhookの利用」</b>をオンにします
              </>,
              <>
                同じ画面の<b>「応答メッセージ」</b>を<b>オフ</b>にします。
                オンのままだと、LINEの自動返信とこちらのおしらせが二重に届いてしまいます
              </>,
            ]}
          />

          <div className="flex gap-2.5 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn-600" />
            <p className="text-2xs leading-relaxed text-warn-700">
              LINE側に「検証」というボタンがあります。押して<b>成功</b>と出れば、
              受け口は正しく伝わっています。
            </p>
          </div>
        </div>
      </SetupStep>

      {/* ---------------- 手順3 ---------------- */}
      <SetupStep
        n={3}
        title="ご予約の画面を、LINEの中で開けるようにする"
        summary="お客様がLINEを離れずに予約できるようにします。次の手順のメニューを出すのに必要です。"
        done={hasLiff}
      >
        <div className="space-y-4">
          <CopyField label="LIFFを作るときに使うURL" value={liffUrl} />
          <Howto
            steps={[
              <>
                LINE Developers で、お店の公式アカウントと<b>同じプロバイダー</b>の中に
                <b>「LINEログイン」</b>のチャネルを1つ作ります
                （予約画面は、この種類のチャネルにしか置けません）
              </>,
              <>
                作ったチャネルの<b>「LIFF」</b>のタブを開き、「追加」を押します
              </>,
              <>
                サイズは<b>「Full」</b>、上のURLを貼り、
                「scope」は <b>profile</b> と <b>openid</b> にチェックを入れます
              </>,
              <>
                できあがった<b>LIFF ID</b>を写して、下の欄に貼り付けます
              </>,
            ]}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <LiffIdForm current={credentials?.liffId ?? null} />
          </div>

          {connected ? null : (
            <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
              <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              先に手順1でLINEとつないでから、こちらを入れてください。
            </p>
          )}
        </div>
      </SetupStep>

      {/* ---------------- 手順4 ---------------- */}
      <SetupStep
        n={4}
        title="LINEの下に出るメニューを出す"
        summary="お客様がトーク画面を開いたときに下へ並ぶボタンです。ここから予約していただきます。"
        done={menuPublished}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {richMenus.map((rm) => {
            // 出す中身はコード側の定義。DBに残る古い内容を見せると、
            // 画面と実際に出るものが食い違う。
            const preset = presetFor(rm.target);
            const areas = preset.areas as { label: string; icon: IconName; path: string }[];
            return (
              <div
                key={rm.id}
                className={`rounded-xl border p-4 ${
                  rm.isPublished ? "border-good-100 bg-good-50/50" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {rm.target === "default"
                        ? "はじめての方に出すメニュー"
                        : "ご予約がある方に出すメニュー"}
                    </p>
                    <p className="mt-0.5 text-2xs text-slate-500">
                      入力欄の上に「{preset.chatBarText}」と表示されます
                    </p>
                  </div>
                  {rm.isPublished ? (
                    <span className="shrink-0 rounded-pill bg-good-600 px-2.5 py-1 text-2xs font-bold text-white">
                      出ています
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-slate-200">
                  {areas.map((a) => (
                    <div
                      key={a.path}
                      className="flex flex-col items-center gap-1.5 bg-brand-50 py-5 text-center"
                    >
                      <Icon name={a.icon} className="h-5 w-5 text-brand-600" />
                      <span className="text-2xs font-medium text-slate-700">{a.label}</span>
                    </div>
                  ))}
                </div>

                <form action={publishRichMenuAction} className="mt-3">
                  <input type="hidden" name="richMenuId" value={rm.id} />
                  <Button
                    type="submit"
                    variant={rm.isPublished ? "secondary" : "primary"}
                    className="w-full"
                    disabled={!connected || !LIFF_IDENTITY_READY || !hasLiff}
                  >
                    <Icon name="send" className="h-4 w-4" />
                    {rm.isPublished ? "もう一度出しなおす" : "このメニューを出す"}
                  </Button>
                </form>
              </div>
            );
          })}
        </div>

        {connected && !hasLiff ? (
          <div className="mt-3 flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3.5">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
            <div className="text-xs leading-relaxed text-warn-700">
              <p className="font-bold">先に上の「手順3」をお願いします</p>
              <p className="mt-1">
                LIFF IDが無いと、メニューを押しても予約画面を開けません
                （開いても、どなたが押したのか分からないためです）。
                登録するとこのボタンが押せるようになります。
              </p>
            </div>
          </div>
        ) : !LIFF_IDENTITY_READY ? (
          <div className="mt-3 flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3.5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
            <div className="text-xs leading-relaxed text-warn-700">
              <p className="font-bold">いまはまだ公開できません（こちらの作業が残っています）</p>
              <p className="mt-1">
                お客様側の画面が、まだ「どなたが開いているか」を見分けられません。
                このまま公開すると、<b>お客様が別のお客様のお名前やご住所を見られてしまいます</b>。
                その仕組みを作り終えるまで、ボタンを押せないようにしています。
                おしらせの送信は、公開しなくても動きます。
              </p>
            </div>
          </div>
        ) : !connected ? (
          <p className="mt-3 flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            先に手順1でLINEとつないでください。つながると押せるようになります。
          </p>
        ) : null}
      </SetupStep>


      {/* ---------------- 届くおしらせ ---------------- */}
      <section className="pt-2">
        <SectionTitle hint="つながっていれば、下のできごとに合わせて自動で届きます。個別の設定は要りません">
          お客様に届くおしらせ
        </SectionTitle>
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {NOTIFICATIONS.map((n) => (
              <li key={n.when} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name={n.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-700">{n.when}</span>
                <Icon name="arrowRight" className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{n.what}</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          文面を変えたいときはお知らせください。前日のおしらせを送る時刻は「お店の設定」から変えられます。
        </p>
      </section>
    </div>
  );
}
