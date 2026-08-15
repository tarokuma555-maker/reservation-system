import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  Button,
  Card,
  DeliveryBadge,
  PaymentBadge,
  SectionTitle,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
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

  // うかがう／オンラインを入れかえるための、いまと逆のメニュー
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
  const visit = reservation.deliveryType === "visit";

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/calendar"
          className="inline-flex items-center gap-1 text-2xs font-bold text-slate-400 transition hover:text-brand-600"
        >
          <Icon name="arrowLeft" className="h-3 w-3" />
          予定表へ戻る
        </Link>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tighter text-ink">
              {reservation.customer.name} 様
              {reservation.customer.companyName ? `（${reservation.customer.companyName}）` : ""}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatRange(reservation.startAt, reservation.endAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DeliveryBadge type={reservation.deliveryType} />
            <StatusBadge status={reservation.status} />
            <PaymentBadge status={reservation.paymentStatus} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <SectionTitle>ご予約の中身</SectionTitle>
            <dl className="space-y-2 text-sm">
              <Row icon="list" label="メニュー" value={reservation.menu.name} />
              {reservation.options.length ? (
                <Row
                  icon="plus"
                  label="追加のご依頼"
                  value={reservation.options.map((o) => o.name).join("・")}
                />
              ) : null}
              <Row icon="clock" label="かかる時間" value={`${reservation.totalMinutes}分`} />
              <Row
                icon="wallet"
                label="いただく金額"
                value={`${formatYen(reservation.totalPrice)}（税こみ）`}
              />
              <Row
                icon={visit ? "pin" : "online"}
                label={visit ? "うかがう場所" : "やり方"}
                value={visit ? (reservation.serviceAddress ?? "—") : "オンライン（ビデオ通話）"}
              />
              {reservation.meetingUrl ? (
                <Row icon="link" label="ビデオ通話のURL" value={reservation.meetingUrl} />
              ) : null}
              <Row icon="phone" label="お電話" value={reservation.customer.phone} />
              {reservation.customerNote ? (
                <Row icon="chat" label="お客様からのご要望" value={reservation.customerNote} />
              ) : null}
              {reservation.recurringRule ? (
                <Row
                  icon="repeat"
                  label="定期のお客様"
                  value={`${reservation.recurringRule.menu.name}${
                    reservation.isException ? "（この回だけ、個別に変えてあります）" : ""
                  }`}
                />
              ) : null}
            </dl>
            {reservation.recurringRule ? (
              <Link
                href={`/admin/recurring/${reservation.recurringRuleId}`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
              >
                定期のきまりを開く
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </Card>

          {isOpen ? (
            <Card>
              <SectionTitle hint="空いている時間と、前後の移動が間に合うかを見て、選べる時間だけ出します">
                日にちや時間をずらす
              </SectionTitle>
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
              <Card className="border-brand-200 bg-brand-50/50">
                <SectionTitle hint="お仕事が終わったら、まずここを押してください">
                  終わったことにする
                </SectionTitle>
                <form action={completeReservation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <select name="paymentStatus" className={`${inputClass} !w-auto`}>
                    <option value="cash_received">現金でいただいた</option>
                    <option value="transfer_confirmed">お振込みを確認した</option>
                    <option value="unpaid">まだいただいていない</option>
                  </select>
                  <Button type="submit">
                    <Icon name="check" className="h-4 w-4" />
                    終わった
                  </Button>
                </form>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                  押すと、お礼のメッセージがLINEに届き、領収書も出せるようになります。
                  売上としても自動で記録されます。
                </p>
              </Card>

              <Card>
                <SectionTitle hint="金額とかかる時間を計算し直します。ビデオ通話のURLも自動で出したり消したりします">
                  {visit ? "オンラインに変える" : "うかがう形に変える"}
                </SectionTitle>
                <form action={switchDeliveryType} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <select name="targetMenuId" className={`${inputClass} min-w-[220px] flex-1`}>
                    {alternativeMenus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.deliveryType === "visit" ? "おうちにうかがう" : "オンライン"}／{m.name}（
                        {formatYen(m.price)}）
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary">
                    <Icon name={visit ? "online" : "visit"} className="h-4 w-4" />
                    {visit ? "オンラインにする" : "うかがう形にする"}
                  </Button>
                </form>
              </Card>

              <Card>
                <SectionTitle hint="お客様にはLINEでお知らせが届きます">
                  お休みにする・お取り消し
                </SectionTitle>
                {reservation.recurringRuleId ? (
                  <form action={skipOccurrence} className="mb-4">
                    <input type="hidden" name="reservationId" value={reservation.id} />
                    <Button type="submit" variant="secondary">
                      <Icon name="skip" className="h-4 w-4" />
                      今回だけお休みにする
                    </Button>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      定期のきまりはそのまま続きます。次回からはいつもどおりです。
                    </p>
                  </form>
                ) : null}
                <form action={cancelReservation} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <input type="hidden" name="by" value="owner" />
                  <input
                    name="reason"
                    placeholder="どうしてお取り消しになるか"
                    className={`${inputClass} min-w-[160px] flex-1`}
                  />
                  <Button type="submit" variant="danger">
                    <Icon name="close" className="h-4 w-4" />
                    このご予約を取り消す
                  </Button>
                </form>
              </Card>
            </>
          ) : null}

          {reservation.invoiceLines.length > 0 ? (
            <Card>
              <SectionTitle>このお仕事で出した書類</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {reservation.invoiceLines.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/admin/invoices/${l.invoiceId}`}
                      className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                    >
                      <Icon name="receipt" className="h-4 w-4" />
                      {l.invoice.issueDate} に出した領収書
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionTitle hint="だれが・いつ・何をしたかが残ります">これまでのやりとり</SectionTitle>
            {reservation.logs.length === 0 ? (
              <p className="text-sm text-slate-500">まだ何もありません</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {reservation.logs.map((log) => (
                  <li key={log.id} className="border-l-2 border-brand-200 pl-3">
                    <p className="font-bold text-slate-700">
                      {log.action}
                      <span className="ml-2 font-normal text-slate-400">
                        {log.actorName || (log.actorType === "customer" ? "お客様" : "こちら")}
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

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="inline-flex shrink-0 items-center gap-1.5 text-slate-500">
        <Icon name={icon} className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </dt>
      <dd className="break-all text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
