import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, PaymentBadge, SectionTitle, StatusBadge } from "@/components/ui";
import {
  cancelReservation,
  completeReservation,
  skipOccurrence,
  switchDeliveryType,
} from "@/app/actions";
import RescheduleForm from "@/components/RescheduleForm";
import { addDays, formatDateJa, formatRange, formatYen, todayStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminReservationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      customer: true,
      menu: true,
      options: true,
      recurringRule: { include: { menu: true } },
      logs: { orderBy: { createdAt: "desc" } },
      invoiceLines: { include: { invoice: true } },
    },
  });
  if (!reservation) notFound();

  // 訪問とオンラインを切り替えるための候補メニュー（いまと逆の形態）
  const alternativeMenus = await prisma.menu.findMany({
    where: {
      isPublished: true,
      deliveryType: reservation.deliveryType === "visit" ? "online" : "visit",
    },
    orderBy: { sortOrder: "asc" },
  });

  const today = todayStr();
  const dates = Array.from({ length: 28 }, (_, i) => addDays(today, i));
  const dateLabels = dates.map((d, i) => (i === 0 ? "今日" : i === 1 ? "明日" : formatDateJa(d)));

  const isOpen = reservation.status === "confirmed";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink">
            {reservation.customer.name} 様
            {reservation.customer.companyName ? `（${reservation.customer.companyName}）` : ""}
          </h1>
          <p className="text-sm text-slate-500">{formatRange(reservation.startAt, reservation.endAt)}</p>
        </div>
        <div className="flex gap-2">
          <DeliveryBadge type={reservation.deliveryType} />
          <StatusBadge status={reservation.status} />
          <PaymentBadge status={reservation.paymentStatus} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <SectionTitle>予約内容</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <Row label="メニュー" value={reservation.menu.name} />
              {reservation.options.length ? (
                <Row label="オプション" value={reservation.options.map((o) => o.name).join("・")} />
              ) : null}
              <Row label="所要時間" value={`${reservation.totalMinutes}分`} />
              <Row label="金額" value={`${formatYen(reservation.totalPrice)}（税込）`} />
              <Row
                label={reservation.deliveryType === "visit" ? "訪問先" : "実施方法"}
                value={
                  reservation.deliveryType === "visit"
                    ? (reservation.serviceAddress ?? "-")
                    : "オンライン（Google Meet）"
                }
              />
              {reservation.meetingUrl ? <Row label="会議URL" value={reservation.meetingUrl} /> : null}
              <Row label="電話" value={reservation.customer.phone} />
              {reservation.customerNote ? (
                <Row label="お客様のご要望" value={reservation.customerNote} />
              ) : null}
              {reservation.recurringRule ? (
                <Row
                  label="定期"
                  value={`${reservation.recurringRule.menu.name}${reservation.isException ? "（この回は個別に変更済み）" : ""}`}
                />
              ) : null}
            </dl>
            {reservation.recurringRule ? (
              <Link
                href={`/admin/recurring/${reservation.recurringRuleId}`}
                className="mt-3 inline-block text-xs text-brand-600 underline"
              >
                この定期ルールを開く →
              </Link>
            ) : null}
          </Card>

          {isOpen ? (
            <Card>
              <SectionTitle hint="空き枠と移動時間を再判定します">日時を変更する</SectionTitle>
              <RescheduleForm
                reservationId={reservation.id}
                menuId={reservation.menuId}
                dates={dates}
                dateLabels={dateLabels}
                by="owner"
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {isOpen ? (
            <>
              <Card>
                <SectionTitle hint="料金と所要時間を再計算し、会議URLの発行・破棄も自動で行います">
                  訪問とオンラインを切り替える
                </SectionTitle>
                <form action={switchDeliveryType} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <select
                    name="targetMenuId"
                    className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  >
                    {alternativeMenus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.deliveryType === "visit" ? "訪問" : "オンライン"}／{m.name}（{formatYen(m.price)}）
                      </option>
                    ))}
                  </select>
                  <button className="rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                    {reservation.deliveryType === "visit" ? "オンラインに変更" : "訪問に変更"}
                  </button>
                </form>
              </Card>

              <Card>
                <SectionTitle>実施の記録</SectionTitle>
                <form action={completeReservation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <select
                    name="paymentStatus"
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  >
                    <option value="cash_received">現金を受領した</option>
                    <option value="transfer_confirmed">振込を確認した</option>
                    <option value="unpaid">まだ入金なし</option>
                  </select>
                  <button className="rounded-pill bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
                    実施済みにする
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-500">
                  実施済みにすると、請求書・領収書の発行対象になります。
                </p>
              </Card>

              <Card>
                <SectionTitle>キャンセル・スキップ</SectionTitle>
                <form action={cancelReservation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <input type="hidden" name="by" value="owner" />
                  <input
                    name="reason"
                    placeholder="理由"
                    className="min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                  <button className="rounded-pill border border-bad-100 bg-surface px-4 py-2.5 text-sm font-bold text-bad-600 transition hover:bg-bad-50">
                    キャンセルする
                  </button>
                </form>
                {reservation.recurringRuleId ? (
                  <form action={skipOccurrence} className="mt-2">
                    <input type="hidden" name="reservationId" value={reservation.id} />
                    <button className="rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300">
                      この回だけスキップ（ルールは継続）
                    </button>
                  </form>
                ) : null}
              </Card>
            </>
          ) : null}

          {reservation.invoiceLines.length > 0 ? (
            <Card>
              <SectionTitle>発行済みの書類</SectionTitle>
              <ul className="space-y-1 text-sm">
                {reservation.invoiceLines.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/invoices/${l.invoiceId}`} className="text-brand-600 underline">
                      {l.invoice.invoiceNumber}（{l.invoice.issueDate}）
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionTitle>操作の履歴</SectionTitle>
            {reservation.logs.length === 0 ? (
              <p className="text-sm text-slate-500">履歴はまだありません</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {reservation.logs.map((log) => (
                  <li key={log.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="font-medium text-slate-700">
                      {log.action}
                      <span className="ml-2 font-normal text-slate-400">
                        {log.actorName || log.actorType}
                      </span>
                    </p>
                    {log.detail ? <p className="text-slate-500">{log.detail}</p> : null}
                    <p className="text-slate-400">
                      {log.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="break-all text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
