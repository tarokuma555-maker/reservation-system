import { prisma } from "@/lib/db";
import { lineMode } from "@/lib/line";
import { Button, Card, Empty, Field, ModeBanner, SectionTitle, inputClass } from "@/components/ui";
import { FlexPreview } from "@/components/FlexPreview";
import { Icon } from "@/components/Icon";
import {
  runOnlineReminderBatchAction,
  runReminderBatchAction,
  simulateWebhookAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent: { label: "お届けずみ", cls: "bg-good-600 text-white" },
  mocked: { label: "まだ送っていません", cls: "bg-slate-200 text-slate-700" },
  failed: { label: "届きませんでした", cls: "bg-bad-100 text-bad-700" },
  queued: { label: "送信の順番待ち", cls: "bg-warn-100 text-warn-700" },
};

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

const EVENT_LABEL: Record<string, string> = {
  follow: "友だち追加",
  unfollow: "ブロック",
  message: "メッセージが届いた",
  postback: "ボタンが押された",
};

export default async function LineLogPage() {
  const [messages, events, customers, live] = await Promise.all([
    prisma.outboundMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: true },
    }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 }),
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    lineMode().then((m) => m === "live"),
  ]);

  const failed = messages.filter((m) => m.status === "failed").length;

  return (
    <div className="space-y-8">
      <ModeBanner
        live={live}
        liveTitle="つながっています。おしらせは実際にお客様へ届いています"
        mockTitle="まだつながっていません（お客様には届いていません）"
      >
        {live ? null : (
          <p>
            送る中身だけは本番と同じものを作って残しています。
            「準備をする」でつなぐと、下に出ている見た目のままお客様に届きます。
          </p>
        )}
      </ModeBanner>

      {failed > 0 ? (
        <div className="flex gap-3 rounded-card border border-bad-100 bg-bad-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-xs leading-relaxed text-bad-700">
            <b>{failed}件</b> のおしらせが届いていません。
            お客様がブロックされている場合もありますが、続くようならお知らせください。
          </p>
        </div>
      ) : null}

      <section>
        <SectionTitle hint="ふだんは自動で送られます。ここから今すぐ送ることもできます">
          いま、まとめて送る
        </SectionTitle>
        <Card className="flex flex-wrap gap-3">
          <form action={runReminderBatchAction}>
            <Button type="submit" variant="secondary">
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
          送ったおしらせ
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
              同じ合図が二重に届いても、処理は一度きりです。
            </span>
          </p>
        </Card>
      </section>

      <details className="group rounded-card border border-slate-200/80 bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:text-brand-700">
          <Icon name="chevronRight" className="h-4 w-4 transition group-open:rotate-90" />
          動きをためす（ふだんは使いません）
        </summary>
        <div className="border-t border-slate-100 p-5">
          <p className="mb-3 text-xs leading-relaxed text-slate-600">
            お客様が友だち追加したときなどに、何が起きるかをここで確かめられます。
            実際のお客様には何も届きません。
          </p>
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
              ためしてみる
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
