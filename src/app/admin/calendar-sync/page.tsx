import Link from "next/link";
import { prisma } from "@/lib/db";
import { getGoogleConnection, listCalendars, targetCalendarId } from "@/lib/google-calendar";
import {
  Button,
  Card,
  Empty,
  Field,
  SectionTitle,
  TableShell,
  Td,
  Th,
  inputClass,
} from "@/components/ui";
import { Icon } from "@/components/Icon";
import GoogleConnectCard from "@/components/GoogleConnectCard";
import { selectCalendarAction } from "@/app/connect-actions";
import { addDays, formatRange, todayStr } from "@/lib/time";
import {
  driftCheckAction,
  importCalendarAction,
  retrySyncAction,
  simulateExternalDeleteAction,
  simulatePersonalEventAction,
  syncAllCalendarAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

/** 画面が長くなりすぎないよう、直近ぶんだけ出す。省いた件数は必ず画面にも書く。 */
const EVENT_LIMIT = 12;

const SYNC_LABEL: Record<string, { label: string; cls: string }> = {
  synced: { label: "うつせました", cls: "bg-good-600 text-white" },
  pending: { label: "まだうつしていません", cls: "bg-warn-100 text-warn-700" },
  failed: { label: "うつせませんでした", cls: "bg-bad-100 text-bad-700" },
  deleted: { label: "消しました", cls: "bg-slate-200 text-slate-600" },
};

export default async function CalendarSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; reason?: string }>;
}) {
  const q = await searchParams;
  const google = await getGoogleConnection();

  const [syncs, events, blocks] = await Promise.all([
    prisma.calendarSync.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.calendarEvent.findMany({ orderBy: { startAt: "asc" }, take: EVENT_LIMIT }),
    prisma.blockedSlot.findMany({
      where: { source: "google" },
      orderBy: { startAt: "asc" },
      take: 20,
    }),
  ]);

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: syncs.map((s) => s.reservationId) } },
    include: { customer: true, menu: true },
  });
  const resMap = new Map(reservations.map((r) => [r.id, r]));

  const failedCount = syncs.filter((s) => s.syncStatus === "failed").length;
  const calendarId = await targetCalendarId();

  // つながっているときだけ、書き出し先を選べるように一覧を取る
  const calendars = google.connected
    ? await listCalendars().catch(() => [] as { id: string; summary: string; primary: boolean }[])
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">カレンダー連携</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          ご予約をGoogleカレンダーにうつしておくと、スマホのカレンダーからも予定が見られます。
          逆に、Googleに入れた私用の予定をこちらに取りこんで、その時間の予約を止めることもできます。
        </p>
      </header>

      {q.connected === "yes" ? (
        <div className="flex gap-3 rounded-card border border-good-100 bg-good-50 px-4 py-3.5">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good-600" strokeWidth={2.6} />
          <p className="text-sm font-bold text-good-700">
            Googleカレンダーにつながりました。これからのご予定は自動でうつります。
          </p>
        </div>
      ) : null}

      {q.connected === "no" ? (
        <div className="flex gap-3 rounded-card border border-bad-100 bg-bad-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-xs leading-relaxed text-bad-700">
            {q.reason ?? "つながりませんでした。もう一度おためしください。"}
          </p>
        </div>
      ) : null}

      <GoogleConnectCard
        connected={google.connected}
        status={google.status}
        lastError={google.lastError}
        connectedAt={google.connectedAt}
        fromEnv={google.fromEnv}
      />

      {google.connected && calendars.length > 0 ? (
        <Card>
          <SectionTitle hint="ご予約を書き出す先です。ふだんお使いのものを選んでください">
            どのカレンダーに書き出すか
          </SectionTitle>
          <form action={selectCalendarAction} className="flex flex-wrap items-end gap-3">
            <Field label="書き出し先" className="min-w-[240px] flex-1">
              <select name="calendarId" defaultValue={calendarId} className={inputClass}>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? "（ふだんお使いのカレンダー）" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" variant="secondary">
              <Icon name="check" className="h-4 w-4" />
              ここに書き出す
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="flex gap-3 rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3.5">
        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-slate-700">
          <b>どちらが正しいか</b>は、いつもこのシステムのほうです。Googleカレンダーは「うつしたもの」なので、
          あちらで予定を消してしまっても、こちらの予約は消えません。ボタン1つで元どおりに戻せます。
        </p>
      </div>

      <section>
        <SectionTitle>いま、うごかす</SectionTitle>
        <Card className="flex flex-wrap gap-3">
          <form action={syncAllCalendarAction}>
            <Button type="submit">
              <Icon name="send" className="h-4 w-4" />
              ご予約をGoogleにうつす
            </Button>
          </form>
          <form action={importCalendarAction}>
            <Button type="submit" variant="secondary">
              <Icon name="download" className="h-4 w-4" />
              Googleの私用予定を取りこむ
            </Button>
          </form>
          <form action={driftCheckAction}>
            <Button type="submit" variant="secondary">
              <Icon name="refresh" className="h-4 w-4" />
              ずれていないか確かめて、直す
            </Button>
          </form>
          {failedCount > 0 ? (
            <form action={retrySyncAction}>
              <Button type="submit" variant="danger">
                <Icon name="alert" className="h-4 w-4" />
                うつせなかった {failedCount}件 をやり直す
              </Button>
            </form>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle
          hint={
            events.length >= EVENT_LIMIT
              ? `本物のGoogleカレンダーにも、この内容で入ります（直近の${EVENT_LIMIT}件だけ出しています）`
              : "本物のGoogleカレンダーにも、この内容で入ります"
          }
        >
          Googleカレンダーの中身
        </SectionTitle>
        {events.length === 0 ? (
          <Empty>
            まだ何も入っていません。上の「ご予約をGoogleにうつす」を押してみてください。
          </Empty>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {events.map((e) => (
              <div key={e.id} className={`px-5 py-3.5 ${e.isDeleted ? "opacity-40" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                      {e.summary}
                      {e.isDeleted ? (
                        <span className="rounded-pill bg-bad-100 px-2 py-0.5 text-2xs font-bold text-bad-700">
                          Google側で消えています
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatRange(e.startAt, e.endAt)}
                    </p>
                    {e.location ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Icon name="pin" className="h-3.5 w-3.5" />
                        {e.location}
                      </p>
                    ) : null}
                    {e.conferenceUrl ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ocean-600">
                        <Icon name="online" className="h-3.5 w-3.5" />
                        ビデオ通話のURLつき
                      </p>
                    ) : null}
                    <p className="mt-1 text-2xs text-slate-400">
                      {e.source === "system"
                        ? "このシステムがうつしたもの"
                        : "Googleに入っていた私用の予定"}
                    </p>
                  </div>
                  {e.source === "system" && !e.isDeleted ? (
                    <form action={simulateExternalDeleteAction}>
                      <input type="hidden" name="googleEventId" value={e.googleEventId} />
                      <Button type="submit" variant="secondary" size="sm">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        Google側で消してみる
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
        <div className="mt-2 flex gap-3 rounded-card border border-slate-200/80 bg-surface px-4 py-3.5">
          <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-xs leading-relaxed text-slate-600">
            <b>ためしてみてください。</b>「Google側で消してみる」を押したあと、上の
            「ずれていないか確かめて、直す」を押すと、消えた予定がひとりでに戻ります。
            うっかりスマホで消してしまっても、お仕事の予定は失われません。
          </p>
        </div>
      </section>

      <section>
        <SectionTitle hint="通院や家族の用事など、Googleに入れている予定を想定しています">
          Google側に私用の予定を入れてみる
        </SectionTitle>
        <Card>
          <form action={simulatePersonalEventAction} className="flex flex-wrap items-end gap-3">
            <Field label="日にち">
              <input
                type="date"
                name="date"
                defaultValue={addDays(todayStr(), 3)}
                className={inputClass}
              />
            </Field>
            <Field label="はじまる時間">
              <input type="time" name="time" defaultValue="13:00" step={1800} className={inputClass} />
            </Field>
            <Field label="どのくらい" hint="分で入れてください">
              <input
                type="number"
                name="minutes"
                defaultValue={90}
                step={30}
                className={`${inputClass} w-28`}
              />
            </Field>
            <Field label="なんの予定" className="min-w-[180px] flex-1">
              <input name="summary" placeholder="通院" className={inputClass} />
            </Field>
            <Button type="submit" variant="secondary">
              <Icon name="plus" className="h-4 w-4" />
              Google側に入れる
            </Button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            入れたあとに「Googleの私用予定を取りこむ」を押すと、その時間はお客様の予約画面から消えます。
            なお、このシステムがうつした予定は取りこみません（同じものが二重になるのを防いでいます）。
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>取りこんだ私用の予定</SectionTitle>
        {blocks.length === 0 ? (
          <Empty>まだ取りこんだ予定はありません</Empty>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-ink">
                  <Icon name="clock" className="h-4 w-4 text-slate-400" />
                  {b.title}
                </span>
                <span className="text-xs text-slate-500">{formatRange(b.startAt, b.endAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle hint="うまくうつせなかったものがないか、ここで確かめられます">
          うつした記録
        </SectionTitle>
        {syncs.length === 0 ? (
          <Empty>まだ記録はありません</Empty>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr>
                <Th>ご予約</Th>
                <Th>ようす</Th>
                <Th align="right">やり直した回数</Th>
                <Th>さいごにうつした日時</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {syncs.map((s) => {
                const r = resMap.get(s.reservationId);
                const label = SYNC_LABEL[s.syncStatus] ?? SYNC_LABEL.pending;
                return (
                  <tr key={s.id}>
                    <Td>
                      {r ? (
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {r.customer.name} 様 ／ {r.menu.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500">（削除された予約）</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`rounded-pill px-2.5 py-1 text-2xs font-bold ${label.cls}`}>
                        {label.label}
                      </span>
                      {s.lastError ? (
                        <p className="mt-1 text-2xs text-bad-600">{s.lastError}</p>
                      ) : null}
                    </Td>
                    <Td align="right">{s.retryCount}</Td>
                    <Td className="text-xs text-slate-500">
                      {s.lastSyncedAt
                        ? s.lastSyncedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </section>

    </div>
  );
}
