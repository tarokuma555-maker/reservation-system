import { prisma } from "./db";
import { flexCard, pushMessage, textMessage } from "./line";
import { getSettings } from "./settings";
import { formatRange, formatYen, toDateStr, toTimeStr } from "./time";

/**
 * 業務上のできごと → LINE通知 の対応づけ。
 * 文面のもとになる値はすべて予約データから組み立てる。
 */

function baseUrl() {
  return process.env.LIFF_BASE_URL ?? "https://example.com/liff";
}

type ReservationWithRelations = Awaited<ReturnType<typeof loadReservation>>;

async function loadReservation(reservationId: string) {
  return prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { customer: true, menu: true, options: true },
  });
}

function commonRows(r: ReservationWithRelations) {
  return [
    { label: "日時", value: formatRange(r.startAt, r.endAt) },
    { label: "メニュー", value: r.menu.name },
    ...(r.options.length
      ? [{ label: "オプション", value: r.options.map((o) => o.name).join("・") }]
      : []),
    { label: "料金", value: `${formatYen(r.totalPrice)}（税込）` },
    r.deliveryType === "visit"
      ? { label: "訪問先", value: r.serviceAddress ?? "-" }
      : { label: "実施方法", value: "オンライン（Google Meet）" },
  ];
}

export async function notifyBookingConfirmed(reservationId: string) {
  const r = await loadReservation(reservationId);
  const s = await getSettings();

  const notice =
    r.deliveryType === "online"
      ? `開始${s.onlineReminderMinutes}分前に、参加用のURLをもう一度お送りします。`
      : `前日${s.reminderHour}時にリマインドをお送りします。48時間前まではキャンセル無料です。`;

  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "booking_confirmed",
    messages: [
      flexCard({
        altText: `ご予約を承りました（${formatRange(r.startAt, r.endAt)}）`,
        title: "ご予約を承りました",
        subtitle: `${r.customer.name} 様`,
        accent: r.deliveryType === "online" ? "online" : "visit",
        rows: commonRows(r),
        notice,
        buttons: [
          { label: "予約を確認する", uri: `${baseUrl()}/reservations/${r.id}` },
          ...(r.deliveryType === "online" && r.meetingUrl
            ? [{ label: "当日の参加URL", uri: r.meetingUrl }]
            : []),
        ],
      }),
    ],
  });
}

export async function notifyRescheduled(reservationId: string, beforeLabel: string) {
  const r = await loadReservation(reservationId);
  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "rescheduled",
    messages: [
      flexCard({
        altText: "ご予約の日時を変更しました",
        title: "日時を変更しました",
        subtitle: `${r.customer.name} 様`,
        accent: r.deliveryType === "online" ? "online" : "visit",
        rows: [
          { label: "変更前", value: beforeLabel },
          { label: "変更後", value: formatRange(r.startAt, r.endAt) },
          { label: "メニュー", value: r.menu.name },
        ],
        buttons: [{ label: "予約を確認する", uri: `${baseUrl()}/reservations/${r.id}` }],
      }),
    ],
  });
}

export async function notifyCancelled(reservationId: string, feeRate: number, fee: number) {
  const r = await loadReservation(reservationId);
  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "cancelled",
    messages: [
      textMessage(
        [
          `${r.customer.name} 様`,
          "",
          `${formatRange(r.startAt, r.endAt)} のご予約をキャンセルいたしました。`,
          feeRate > 0
            ? `キャンセル料 ${feeRate}%（${formatYen(fee)}）を申し受けます。`
            : "キャンセル料はかかりません。",
          "",
          "またのご利用をお待ちしております。",
        ].join("\n")
      ),
    ],
  });
}

export async function notifySkipped(reservationId: string) {
  const r = await loadReservation(reservationId);
  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "skipped",
    messages: [
      textMessage(
        `${formatRange(r.startAt, r.endAt)} の定期のご利用を、今回はお休みとして承りました。\n次回以降は通常どおりお伺いします。`
      ),
    ],
  });
}

/** 前日リマインド */
export async function notifyReminder(reservationId: string) {
  const r = await loadReservation(reservationId);
  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "reminder",
    messages: [
      flexCard({
        altText: `明日 ${toTimeStr(r.startAt)} のご予約`,
        title: "明日のご予約のお知らせ",
        subtitle: `${r.customer.name} 様`,
        accent: r.deliveryType === "online" ? "online" : "visit",
        rows: commonRows(r),
        notice:
          r.deliveryType === "online"
            ? "お部屋を映していただけると、より具体的にご提案できます。"
            : "当日は開始時刻の5分前を目安にお伺いします。",
        buttons: [
          { label: "変更・キャンセル", uri: `${baseUrl()}/reservations/${r.id}` },
          ...(r.deliveryType === "online" && r.meetingUrl
            ? [{ label: "参加URL", uri: r.meetingUrl }]
            : []),
        ],
      }),
    ],
  });
}

/** オンライン開始直前のリマインド */
export async function notifyOnlineSoon(reservationId: string) {
  const r = await loadReservation(reservationId);
  const s = await getSettings();
  if (r.deliveryType !== "online" || !r.meetingUrl) return null;

  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "online_soon",
    messages: [
      flexCard({
        altText: "まもなくオンライン相談が始まります",
        title: `まもなく開始です（${s.onlineReminderMinutes}分前）`,
        subtitle: `${toTimeStr(r.startAt)} 開始`,
        accent: "online",
        rows: [
          { label: "メニュー", value: r.menu.name },
          { label: "所要時間", value: `約${r.totalMinutes}分` },
        ],
        notice: "つながらない場合は、お電話でご連絡ください。",
        buttons: [{ label: "参加する", uri: r.meetingUrl }],
      }),
    ],
  });
}

/** 実施後のお礼 */
export async function notifyCompleted(reservationId: string) {
  const r = await loadReservation(reservationId);
  return pushMessage({
    customerId: r.customerId,
    reservationId: r.id,
    type: "completed",
    messages: [
      flexCard({
        altText: "本日はありがとうございました",
        title: "本日はありがとうございました",
        subtitle: `${r.customer.name} 様`,
        accent: r.deliveryType === "online" ? "online" : "visit",
        rows: [
          { label: "実施日", value: toDateStr(r.startAt) },
          { label: "メニュー", value: r.menu.name },
          { label: "料金", value: `${formatYen(r.totalPrice)}（税込）` },
        ],
        notice: "次回のご予約もお待ちしております。",
        buttons: [{ label: "次回の予約をとる", uri: `${baseUrl()}/menus` }],
      }),
    ],
  });
}

/** 領収書・請求書の送付 */
export async function notifyInvoiceIssued(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { customer: true, lines: true },
  });

  const label =
    invoice.type === "receipt"
      ? "領収書"
      : invoice.type === "invoice"
        ? "請求書"
        : invoice.type === "returned"
          ? "適格返還請求書"
          : "修正インボイス";

  const pdfUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/invoices/${invoice.id}/pdf`;

  return pushMessage({
    customerId: invoice.customerId,
    type: "invoice",
    messages: [
      flexCard({
        altText: `${label}を発行しました（${invoice.invoiceNumber}）`,
        title: `${label}をお送りします`,
        subtitle: invoice.recipientName,
        rows: [
          { label: "番号", value: invoice.invoiceNumber },
          { label: "発行日", value: invoice.issueDate },
          { label: "金額", value: `${formatYen(invoice.totalAmount)}（税込）` },
          { label: "登録番号", value: invoice.registrationNumber },
        ],
        notice: "適格請求書等保存方式（インボイス制度）の記載事項を満たした書類です。",
        buttons: [{ label: "PDFを開く", uri: pdfUrl }],
      }),
    ],
  });
}

/** 友だち追加時の挨拶 */
export async function notifyWelcome(customerId: string) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  return pushMessage({
    customerId,
    type: "welcome",
    messages: [
      flexCard({
        altText: "友だち追加ありがとうございます",
        title: "友だち追加ありがとうございます",
        subtitle: `${customer.name} 様`,
        rows: [
          { label: "できること", value: "ご予約・変更・キャンセル・定期利用の管理" },
          { label: "受付時間", value: "24時間いつでも（施術は営業時間内）" },
        ],
        notice: "下のメニューからご予約いただけます。",
        buttons: [{ label: "予約する", uri: `${baseUrl()}/menus` }],
      }),
    ],
  });
}
