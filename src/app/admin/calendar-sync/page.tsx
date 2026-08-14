import Link from "next/link";
import { prisma } from "@/lib/db";
import { googleMode, targetCalendarId } from "@/lib/google-calendar";
import { Card, Empty, ProvisionalNote, SectionTitle } from "@/components/ui";
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

const SYNC_LABEL: Record<string, { label: string; cls: string }> = {
  synced: { label: "同期済", cls: "bg-sage-500 text-white" },
  pending: { label: "未同期", cls: "bg-amber-100 text-amber-700" },
  failed: { label: "失敗", cls: "bg-rose-100 text-rose-700" },
  deleted: { label: "削除済", cls: "bg-slate-200 text-slate-600" },
};

export default async function CalendarSyncPage() {
  const [syncs, events, blocks] = await Promise.all([
    prisma.calendarSync.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.calendarEvent.findMany({ orderBy: { startAt: "asc" }, take: 40 }),
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

  const live = googleMode() === "live";
  const failedCount = syncs.filter((s) => s.syncStatus === "failed").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold text-ink">Googleカレンダー同期</h1>
        <p className="text-sm text-slate-500">
          予約の正はこのシステム。Googleカレンダーはミラーであり、私用予定の取り込み口です。
        </p>
      </header>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          live
            ? "border-sage-300 bg-sage-50 text-sage-700"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p className="font-bold">
          {live
            ? `ライブモード: ${targetCalendarId()} に書き出しています`
            : "モックモード: Google側の状態をこのシステム内で再現しています"}
        </p>
        {!live ? (
          <p className="mt-1 text-xs leading-relaxed">
            <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> /{" "}
            <code>GOOGLE_REFRESH_TOKEN</code> を設定すると実接続に切り替わります。
            下の「Google側のカレンダー」は、実際にAPIへ送るのと同じ内容で作られています。
          </p>
        ) : null}
      </div>

      <section>
        <SectionTitle>同期の操作</SectionTitle>
        <Card className="flex flex-wrap gap-3">
          <form action={syncAllCalendarAction}>
            <button className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white">
              すべての予約を書き出す
            </button>
          </form>
          <form action={importCalendarAction}>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
              私用予定を取り込む（ブロック枠にする）
            </button>
          </form>
          <form action={driftCheckAction}>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
              不整合を検知して復元する
            </button>
          </form>
          {failedCount > 0 ? (
            <form action={retrySyncAction}>
              <button className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm text-rose-600">
                失敗した同期をやり直す（{failedCount}件）
              </button>
            </form>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle hint="実際のGoogleカレンダーに作られるイベントと同じ内容です">
          Google側のカレンダー
        </SectionTitle>
        {events.length === 0 ? (
          <Empty>まだイベントがありません。「すべての予約を書き出す」を押してください。</Empty>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {events.map((e) => (
              <div key={e.id} className={`px-4 py-3 ${e.isDeleted ? "opacity-40" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {e.summary}
                      {e.isDeleted ? (
                        <span className="ml-2 text-xs text-rose-600">Google側で削除済み</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">{formatRange(e.startAt, e.endAt)}</p>
                    {e.location ? (
                      <p className="text-xs text-slate-500">場所: {e.location}</p>
                    ) : null}
                    {e.conferenceUrl ? (
                      <p className="text-xs text-clay-600">Meet: {e.conferenceUrl}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {e.source === "system"
                        ? `extendedProperties.private.reservationId = ${e.privateReservationId}`
                        : "私用予定（システムが作ったものではない）"}
                    </p>
                  </div>
                  {e.source === "system" && !e.isDeleted ? (
                    <form action={simulateExternalDeleteAction}>
                      <input type="hidden" name="googleEventId" value={e.googleEventId} />
                      <button className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600">
                        Google側で消してみる
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
        <p className="mt-2 text-xs text-slate-500">
          「Google側で消してみる」→「不整合を検知して復元する」の順に押すと、
          <b>システム側を正としてイベントが復元される</b>ことを確認できます。
        </p>
      </section>

      <section>
        <SectionTitle hint="Googleに入れた私用の予定は、予約を受け付けない時間になります">
          私用予定を追加してみる
        </SectionTitle>
        <Card>
          <form action={simulatePersonalEventAction} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              日付
              <input
                type="date"
                name="date"
                defaultValue={addDays(todayStr(), 3)}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              開始
              <input
                type="time"
                name="time"
                defaultValue="13:00"
                step={1800}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              長さ（分）
              <input
                type="number"
                name="minutes"
                defaultValue={90}
                step={30}
                className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="min-w-[160px] flex-1 text-xs text-slate-500">
              内容
              <input
                name="summary"
                placeholder="通院"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
              Google側に追加
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            追加したあと「私用予定を取り込む」を押すと、ブロック枠になって空き枠から外れます。
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>取り込んだ私用予定（ブロック枠）</SectionTitle>
        {blocks.length === 0 ? (
          <Empty>取り込んだ予定はありません</Empty>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{b.title}</span>
                <span className="text-xs text-slate-500">{formatRange(b.startAt, b.endAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>同期の状態</SectionTitle>
        {syncs.length === 0 ? (
          <Empty>同期の記録はありません</Empty>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">予約</th>
                  <th className="px-4 py-2 text-left">状態</th>
                  <th className="px-4 py-2 text-left">イベントID</th>
                  <th className="px-4 py-2 text-right">リトライ</th>
                  <th className="px-4 py-2 text-left">最終同期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncs.map((s) => {
                  const r = resMap.get(s.reservationId);
                  const label = SYNC_LABEL[s.syncStatus] ?? SYNC_LABEL.pending;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2">
                        {r ? (
                          <Link
                            href={`/admin/reservations/${r.id}`}
                            className="text-sage-600 hover:underline"
                          >
                            {r.customer.name} 様 / {r.menu.name}
                          </Link>
                        ) : (
                          s.reservationId
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-[11px] ${label.cls}`}>
                          {label.label}
                        </span>
                        {s.lastError ? (
                          <p className="mt-1 text-[11px] text-rose-600">{s.lastError}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{s.googleEventId ?? "-"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.retryCount}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {s.lastSyncedAt
                          ? s.lastSyncedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <ProvisionalNote>
        本番接続に必要なもの: Google Cloud プロジェクトと Calendar API の有効化、OAuth クライアント、
        オーナーのGoogleアカウントでの初回認可（リフレッシュトークンの取得）、書き出し先カレンダーの指定。
      </ProvisionalNote>
    </div>
  );
}
