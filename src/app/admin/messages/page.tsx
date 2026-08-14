import { prisma } from "@/lib/db";
import { lineMode } from "@/lib/line";
import { Button, Card, Empty, Field, ModeBanner, SectionTitle, inputClass } from "@/components/ui";
import { FlexPreview } from "@/components/FlexPreview";
import { Icon, type IconName } from "@/components/Icon";
import {
  publishRichMenuAction,
  runOnlineReminderBatchAction,
  runReminderBatchAction,
  simulateWebhookAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent: { label: "お届けずみ", cls: "bg-good-600 text-white" },
  mocked: { label: "お試し（実際には送っていません）", cls: "bg-slate-200 text-slate-700" },
  failed: { label: "届きませんでした", cls: "bg-bad-100 text-bad-700" },
  queued: { label: "送信の順番待ち", cls: "bg-warn-100 text-warn-700" },
};

/** メッセージの種類を、ふだんの言葉に置きかえる */
const TYPE_LABEL: Record<string, string> = {
  booking_confirmed: "ご予約を承りました",
  rescheduled: "日時の変更をお知らせ",
  cancelled: "キャンセルをお知らせ",
  skipped: "今回のお休みをお知らせ",
  reminder: "前日のおしらせ",
  online_soon: "オンライン開始前のおしらせ",
  completed: "おわったあとのお礼",
  invoice: "領収書のお届け",
  welcome: "はじめましてのごあいさつ",
};

/** LINEから届く動きの種類 */
const EVENT_LABEL: Record<string, string> = {
  follow: "友だち追加",
  unfollow: "ブロック",
  message: "メッセージが届いた",
  postback: "ボタンが押された",
};

export default async function MessagesPage() {
  const [messages, events, richMenus, customers] = await Promise.all([
    prisma.outboundMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: true },
    }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 }),
    prisma.richMenu.findMany({ orderBy: { target: "asc" } }),
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const live = lineMode() === "live";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">LINEの設定</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          お客様にお送りするおしらせと、LINEの下に出るメニューをここで確かめられます。
        </p>
      </header>

      <ModeBanner
        live={live}
        liveTitle="LINEにつながっています。実際にお客様へ届きます"
        mockTitle="いまは お試しモード です（お客様には届きません）"
      >
        {live ? null : (
          <p>
            LINE公式アカウントの管理ページで発行できる「合いことば」を2つ入れると、そのままお客様に届くようになります。
            <b>お試し中でも、お送りする中身は本番とまったく同じもの</b>を作っています。
            下に出ている見た目のまま、お客様のトーク画面に表示されます。
          </p>
        )}
      </ModeBanner>

      <section>
        <SectionTitle hint="本番では、毎日決まった時間に自動で送られます">
          いま、まとめて送る
        </SectionTitle>
        <Card className="flex flex-wrap gap-3">
          <form action={runReminderBatchAction}>
            <Button type="submit">
              <Icon name="bell" className="h-4 w-4" />
              明日のお客様に「前日のおしらせ」を送る
            </Button>
          </form>
          <form action={runOnlineReminderBatchAction}>
            <Button type="submit" variant="secondary">
              <Icon name="online" className="h-4 w-4" />
              まもなく始まるオンラインのお客様に送る
            </Button>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle hint="お客様のトーク画面には、この見た目のまま表示されます">
          これまでに送ったおしらせ
        </SectionTitle>
        {messages.length === 0 ? (
          <Empty>まだ1通も送っていません</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {messages.map((m) => {
              const s = STATUS_LABEL[m.status] ?? STATUS_LABEL.queued;
              return (
                <Card key={m.id}>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{m.customer.name} 様</p>
                      <p className="text-2xs text-slate-500">{TYPE_LABEL[m.type] ?? m.type}</p>
                    </div>
                    <span className={`rounded-pill px-2.5 py-1 text-2xs font-bold ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3">
                    <FlexPreview payload={m.payload} />
                  </div>
                  {m.errorMessage ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-bad-600">
                      <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {m.errorMessage}
                    </p>
                  ) : null}
                  <details className="group mt-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs text-slate-400 transition hover:text-slate-600">
                      <Icon name="chevronRight" className="h-3 w-3 transition group-open:rotate-90" />
                      LINEに渡している中身を見る（ふだんは開かなくて大丈夫です）
                    </summary>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3.5 text-[10px] leading-relaxed text-brand-100">
                      {m.payload}
                    </pre>
                  </details>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle hint="お客様がLINEで何かしたときに、こちらへ届く合図です">
          LINEから届いた動き
        </SectionTitle>
        <Card className="space-y-4">
          <form action={simulateWebhookAction} className="flex flex-wrap items-end gap-3">
            <Field label="どんな動き">
              <select name="eventType" className={inputClass}>
                <option value="follow">友だち追加された</option>
                <option value="message">メッセージが届いた</option>
                <option value="postback">ボタンが押された</option>
                <option value="unfollow">ブロックされた</option>
              </select>
            </Field>
            <Field label="どのお客様">
              <select name="lineUserId" className={inputClass}>
                {customers.map((c) => (
                  <option key={c.id} value={c.lineUserId}>
                    {c.name}
                  </option>
                ))}
                <option value="U_demo_newcomer">（はじめての方）</option>
              </select>
            </Field>
            <Field label="メッセージの中身" className="min-w-[180px] flex-1">
              <input name="text" placeholder="予約を変更したいです" className={inputClass} />
            </Field>
            <Button type="submit" variant="secondary">
              <Icon name="send" className="h-4 w-4" />
              ためしに起こしてみる
            </Button>
          </form>

          {events.length === 0 ? (
            <p className="text-sm text-slate-500">まだ何も届いていません</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2.5">
                  <p className="font-bold text-slate-700">
                    {EVENT_LABEL[e.type] ?? e.type}
                    <span className="ml-2 text-2xs font-normal text-slate-400">
                      {e.receivedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">{e.note}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-start gap-1.5 border-t border-slate-100 pt-3 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              本物のLINEから届いたものかどうかを毎回たしかめてから受け取っています。
              また、同じ合図が二重に届いても、処理は一度きりです（お客様に同じおしらせが2通いくのを防ぎます）。
            </span>
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle hint="はじめての方と、すでにご予約がある方で、出すメニューを変えられます">
          LINEの下に出るメニュー
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {richMenus.map((rm) => {
            const areas = JSON.parse(rm.areas) as { label: string; icon: IconName; path: string }[];
            return (
              <Card key={rm.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{rm.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {rm.target === "default" ? "はじめての方に出します" : "ご予約がある方に出します"}
                    </p>
                    <p className="text-2xs text-slate-400">
                      入力欄の上には「{rm.chatBarText}」と表示されます
                    </p>
                  </div>
                  {rm.isPublished ? (
                    <span className="shrink-0 rounded-pill bg-good-600 px-2.5 py-1 text-2xs font-bold text-white">
                      公開中
                    </span>
                  ) : null}
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-slate-200">
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
                  <Button type="submit" variant="secondary" className="w-full">
                    このメニューをLINEに出す
                  </Button>
                </form>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3 rounded-card border border-slate-200/80 bg-surface px-4 py-3.5">
        <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-xs leading-relaxed text-slate-600">
          <p className="font-bold text-ink">本物のLINEにつなぐには</p>
          <p className="mt-1">
            LINE公式アカウントの管理ページで「合いことば」を2つ発行し、この画面の設定に入れるだけです。
            そのほかに、メニューの背景画像（よこ2500 × たて1686 の絵）を1枚ご用意ください。
            この作業はこちらで代行できます。
          </p>
        </div>
      </div>
    </div>
  );
}
