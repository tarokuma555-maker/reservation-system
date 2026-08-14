import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings, resolveCancelPolicy } from "@/lib/settings";
import { addDays, formatDateJa, formatRange, formatYen, now, todayStr } from "@/lib/time";
import { DeliveryBadge, StatusBadge } from "@/components/ui";
import { cancelReservation, skipOccurrence } from "@/app/actions";
import RescheduleForm from "@/components/RescheduleForm";

export const dynamic = "force-dynamic";

export default async function ReservationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const [reservation, settings] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: { menu: true, options: true, customer: true, recurringRule: true },
    }),
    getSettings(),
  ]);
  if (!reservation) notFound();

  const hoursUntil = (reservation.startAt.getTime() - now().getTime()) / 3_600_000;
  const policy = resolveCancelPolicy(settings, hoursUntil);
  const cancelFee = Math.floor((reservation.totalPrice * policy.feeRate) / 100);
  const isActive = reservation.status === "confirmed" && hoursUntil > 0;

  const today = todayStr();
  const dates = Array.from({ length: 21 }, (_, i) => addDays(today, i));
  const dateLabels = dates.map((d, i) => (i === 0 ? "今日" : i === 1 ? "明日" : formatDateJa(d)));

  return (
    <div className="space-y-5 p-4">
      {created ? (
        <div className="rounded-card border border-good-100 bg-good-50 p-5 text-sm text-good-700">
          <p className="font-bold">ご予約を承りました</p>
          <p className="mt-1 text-xs leading-relaxed">
            確定のご連絡をLINEにお送りしました。前日{settings.reminderHour}時にリマインドをお送りします。
          </p>
        </div>
      ) : null}

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight text-ink">ご予約の詳細</h1>
          <div className="flex gap-1">
            <DeliveryBadge type={reservation.deliveryType} />
            <StatusBadge status={reservation.status} />
          </div>
        </div>
      </div>

      <dl className="space-y-2 rounded-card border border-slate-200/80 bg-surface p-5 text-sm">
        <Row label="日時" value={formatRange(reservation.startAt, reservation.endAt)} />
        <Row label="メニュー" value={reservation.menu.name} />
        {reservation.options.length > 0 ? (
          <Row label="オプション" value={reservation.options.map((o) => o.name).join("・")} />
        ) : null}
        <Row label="所要時間" value={`約${reservation.totalMinutes}分`} />
        <Row label="料金" value={`${formatYen(reservation.totalPrice)}（税込）`} />
        {reservation.deliveryType === "visit" ? (
          <Row label="訪問先" value={reservation.serviceAddress ?? "-"} />
        ) : (
          <Row label="実施方法" value="オンライン（Google Meet）" />
        )}
        {reservation.recurringRule ? <Row label="種別" value="定期利用の1回分" /> : null}
        {reservation.customerNote ? <Row label="ご要望" value={reservation.customerNote} /> : null}
      </dl>

      {reservation.deliveryType === "online" && reservation.meetingUrl && isActive ? (
        <div className="rounded-2xl border border-ocean-500/30 bg-ocean-100 p-4">
          <p className="text-xs font-bold text-ocean-600">オンライン相談のご参加URL</p>
          <p className="mt-1 break-all text-xs text-ocean-600">{reservation.meetingUrl}</p>
          <p className="mt-2 text-2xs text-ocean-600">
            開始{settings.onlineReminderMinutes}分前にも、このURLをLINEでお送りします。
          </p>
        </div>
      ) : null}

      {isActive ? (
        <>
          <section className="rounded-card border border-slate-200/80 bg-surface p-5">
            <h2 className="text-sm font-bold text-ink">日時を変更する</h2>
            <p className="mb-3 mt-1 text-xs text-slate-500">
              変更後の空き状況が表示されます。前後のご予約との移動時間も考慮しています。
            </p>
            <RescheduleForm
              reservationId={reservation.id}
              menuId={reservation.menuId}
              dates={dates}
              dateLabels={dateLabels}
            />
          </section>

          <section className="rounded-card border border-slate-200/80 bg-surface p-5">
            <h2 className="text-sm font-bold text-ink">キャンセルする</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              開始まで約{Math.floor(hoursUntil)}時間です。
              {policy.feeRate === 0
                ? "いまキャンセルされる場合、キャンセル料はかかりません。"
                : `いまキャンセルされる場合、キャンセル料 ${policy.feeRate}%（${formatYen(cancelFee)}）を申し受けます。`}
            </p>

            {policy.selfServiceAllowed ? (
              <form action={cancelReservation} className="mt-3 space-y-2">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="by" value="customer" />
                <input
                  name="reason"
                  placeholder="理由（任意）"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-bad-100 py-2 text-sm font-medium text-bad-600"
                >
                  {policy.feeRate === 0
                    ? "キャンセルする"
                    : `キャンセル料 ${policy.feeRate}% に同意してキャンセルする`}
                </button>
              </form>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                24時間を切っているため、この画面からのキャンセルは承れません。
                お手数ですがトークからご連絡ください。
              </p>
            )}

            {reservation.recurringRuleId ? (
              <form action={skipOccurrence} className="mt-3">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <button
                  type="submit"
                  className="w-full rounded-pill border border-slate-200 bg-surface py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  今回だけお休みする（定期は続けます）
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}

      <Link href="/liff/reservations" className="block text-center text-xs text-brand-600 underline">
        予約一覧に戻る
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
