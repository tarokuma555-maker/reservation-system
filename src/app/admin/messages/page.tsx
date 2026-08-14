import { prisma } from "@/lib/db";
import { lineMode } from "@/lib/line";
import { Card, Empty, ProvisionalNote, SectionTitle } from "@/components/ui";
import { FlexPreview } from "@/components/FlexPreview";
import {
  publishRichMenuAction,
  runOnlineReminderBatchAction,
  runReminderBatchAction,
  simulateWebhookAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent: { label: "送信済", cls: "bg-good-600 text-white" },
  mocked: { label: "モック送信", cls: "bg-slate-200 text-slate-700" },
  failed: { label: "送信失敗", cls: "bg-bad-100 text-bad-700" },
  queued: { label: "送信待ち", cls: "bg-warn-100 text-warn-700" },
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
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">LINE連携</h1>
        <p className="text-sm text-slate-500">
          送信したメッセージ、受信したWebhook、リッチメニューの管理
        </p>
      </header>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          live
            ? "border-good-100 bg-good-50 text-good-700"
            : "border-warn-100 bg-warn-50 text-warn-700"
        }`}
      >
        <p className="font-bold">
          {live ? "ライブモード: 実際にLINEへ送信しています" : "モックモード: LINEへは送信していません"}
        </p>
        {!live ? (
          <p className="mt-1 text-xs leading-relaxed">
            <code>LINE_CHANNEL_ACCESS_TOKEN</code> と <code>LINE_CHANNEL_SECRET</code>
            を設定すると、コードを変えずに実接続に切り替わります。
            モックモードでも<b>実際に送るJSONは同じもの</b>を組み立てて保存しているため、
            下の内容がそのままお客様に届きます。
          </p>
        ) : null}
      </div>

      <section>
        <SectionTitle hint="本番では毎日決まった時刻に自動で走ります">
          通知バッチを手動で実行する
        </SectionTitle>
        <Card className="flex flex-wrap gap-3">
          <form action={runReminderBatchAction}>
            <button className="rounded-pill bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
              明日の予約に前日リマインドを送る
            </button>
          </form>
          <form action={runOnlineReminderBatchAction}>
            <button className="rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
              オンライン開始前リマインドを送る
            </button>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle hint="お客様のトーク画面にそのまま表示されます">送信したメッセージ</SectionTitle>
        {messages.length === 0 ? (
          <Empty>まだ送信していません</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {messages.map((m) => {
              const s = STATUS_LABEL[m.status] ?? STATUS_LABEL.queued;
              return (
                <Card key={m.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {m.customer.name} 様
                      <span className="ml-2 text-xs font-normal text-slate-500">{m.type}</span>
                    </p>
                    <span className={`rounded px-2 py-0.5 text-2xs ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-3">
                    <FlexPreview payload={m.payload} />
                  </div>
                  {m.errorMessage ? (
                    <p className="mt-2 text-xs text-bad-600">{m.errorMessage}</p>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-2xs text-slate-500">
                      実際に送るJSONを見る
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
        <SectionTitle hint="署名検証・冪等処理を通してから処理されます">
          受信したWebhookイベント
        </SectionTitle>
        <Card className="space-y-3">
          <form action={simulateWebhookAction} className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              種別
              <select
                name="eventType"
                className="mt-1 block rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              >
                <option value="follow">follow（友だち追加）</option>
                <option value="message">message（メッセージ受信）</option>
                <option value="postback">postback（ボタン操作）</option>
                <option value="unfollow">unfollow（ブロック）</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              ユーザー
              <select
                name="lineUserId"
                className="mt-1 block rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.lineUserId}>
                    {c.name}
                  </option>
                ))}
                <option value="U_demo_newcomer">（未登録の新しいユーザー）</option>
              </select>
            </label>
            <label className="min-w-[160px] flex-1 text-xs text-slate-500">
              本文 / postbackデータ
              <input
                name="text"
                placeholder="予約を変更したいです"
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
            </label>
            <button className="rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
              疑似イベントを送る
            </button>
          </form>

          {events.length === 0 ? (
            <p className="text-sm text-slate-500">まだ受信していません</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium text-slate-700">
                    {e.type}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {e.receivedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">{e.note}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle hint="未予約の方と予約がある方でメニューを出し分けます">
          リッチメニュー
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {richMenus.map((rm) => {
            const areas = JSON.parse(rm.areas) as { label: string; icon: string; path: string }[];
            return (
              <Card key={rm.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{rm.name}</p>
                    <p className="text-xs text-slate-500">
                      {rm.target === "default" ? "未予約の方向け" : "予約がある方向け"} ／ トークバー「
                      {rm.chatBarText}」
                    </p>
                  </div>
                  {rm.isPublished ? (
                    <span className="rounded bg-brand-500 px-2 py-0.5 text-2xs text-white">
                      公開中
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg border border-slate-200">
                  {areas.map((a) => (
                    <div
                      key={a.path}
                      className="flex flex-col items-center gap-1 bg-brand-50 py-4 text-center"
                    >
                      <span className="text-xl">{a.icon}</span>
                      <span className="text-2xs text-slate-700">{a.label}</span>
                    </div>
                  ))}
                </div>

                {rm.lineRichMenuId ? (
                  <p className="mt-2 text-2xs text-slate-500">
                    richMenuId: {rm.lineRichMenuId}
                  </p>
                ) : null}

                <form action={publishRichMenuAction} className="mt-3">
                  <input type="hidden" name="richMenuId" value={rm.id} />
                  <button className="w-full rounded-pill border border-slate-200 bg-surface py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                    このメニューを登録して公開する
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      </section>

      <ProvisionalNote>
        本番接続に必要なもの: LINE Developers でのMessaging APIチャネル作成、チャネルアクセストークンと
        チャネルシークレット、Webhook URL（<code>/api/line/webhook</code>）の登録、LIFFアプリの作成。
        リッチメニューの画像（2500×1686）は別途ご用意ください。
      </ProvisionalNote>
    </div>
  );
}
