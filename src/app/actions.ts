"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEMO_CUSTOMER_COOKIE, getOwner } from "@/lib/session";
import { getSettings, resolveCancelPolicy, saveSettings } from "@/lib/settings";
import { addDays, addMinutes, formatRange, jst, now, toDateStr, todayStr } from "@/lib/time";
import { layoutAdjustment } from "@/lib/availability";
import { applyRuleChange, endRule, generateOccurrences, pauseRule, resumeRule } from "@/lib/recurring";
import { issueInvoice, issueReturnedInvoice, voidInvoice, InvoiceValidationError } from "@/lib/invoice";
import {
  notifyBookingConfirmed,
  notifyCancelled,
  notifyCompleted,
  notifyInvoiceIssued,
  notifyOnlineSoon,
  notifyReminder,
  notifyRescheduled,
  notifySkipped,
} from "@/lib/notifications";
import {
  deleteReservationFromCalendar,
  detectAndRepairDrift,
  importPersonalEventsAsBlocks,
  retryFailedSyncs,
  syncAllReservations,
  syncReservationToCalendar,
} from "@/lib/google-calendar";
import { buildRichMenuPayload, linkRichMenuToUser, registerRichMenu } from "@/lib/line";
import { generateInvoicePdf } from "@/lib/pdf";
import { parseReceipt, runOcr, suggestAccountCode, isSmallAmountException } from "@/lib/ocr";
import {
  ensureChartOfAccounts,
  ensureFiscalYear,
  journalizeExpense,
  journalizeInvoice,
  journalizePayment,
  runDepreciation,
} from "@/lib/accounting";

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- デモ用: 操作する顧客の切替 ---------------- */

export async function switchCustomer(formData: FormData) {
  const id = String(formData.get("customerId") ?? "");
  const store = await cookies();
  store.set(DEMO_CUSTOMER_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  refresh();
}

/* ---------------- 予約 ---------------- */

export async function createReservation(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const menuId = String(formData.get("menuId"));
  const dateStr = String(formData.get("date"));
  const time = String(formData.get("time"));
  const optionIds = formData.getAll("optionIds").map(String).filter(Boolean);
  const customerNote = String(formData.get("customerNote") ?? "");

  const [settings, owner, menu, customer] = await Promise.all([
    getSettings(),
    getOwner(),
    prisma.menu.findUniqueOrThrow({ where: { id: menuId } }),
    prisma.customer.findUniqueOrThrow({ where: { id: customerId } }),
  ]);

  const options = optionIds.length
    ? await prisma.menuOption.findMany({ where: { id: { in: optionIds } } })
    : [];

  const adjust = layoutAdjustment(
    settings,
    menu.deliveryType as "visit" | "online",
    menu.applyLayoutAdjust,
    customer.layout
  );
  const totalMinutes =
    menu.durationMinutes + options.reduce((s, o) => s + o.additionalMinutes, 0) + adjust;
  const totalPrice = menu.price + options.reduce((s, o) => s + o.additionalPrice, 0);

  const start = jst(dateStr, time);
  const end = addMinutes(start, totalMinutes);

  const reservation = await prisma.reservation.create({
    data: {
      customerId,
      staffId: owner.id,
      menuId,
      startAt: start,
      endAt: end,
      totalMinutes,
      totalPrice,
      status: "confirmed",
      deliveryType: menu.deliveryType,
      serviceAddress:
        menu.deliveryType === "visit"
          ? [customer.address, customer.buildingName].filter(Boolean).join(" ")
          : null,
      customerNote,
      source: "line",
      options: {
        create: options.map((o) => ({
          optionId: o.id,
          name: o.name,
          additionalMinutes: o.additionalMinutes,
          additionalPrice: o.additionalPrice,
        })),
      },
    },
  });

  await prisma.reservationLog.create({
    data: {
      reservationId: reservation.id,
      actorType: "customer",
      actorName: customer.name,
      action: "予約を作成",
      detail: `${dateStr} ${time} / ${menu.name}`,
    },
  });

  // Googleカレンダーへ書き出す（オンラインならここで会議URLが発行される）
  await syncReservationToCalendar(reservation.id);
  // 予約確定をLINEで通知する
  await notifyBookingConfirmed(reservation.id);

  refresh();
  redirect(`/liff/reservations/${reservation.id}?created=1`);
}

export async function cancelReservation(formData: FormData) {
  const id = String(formData.get("reservationId"));
  const by = String(formData.get("by") ?? "customer");
  const reason = String(formData.get("reason") ?? "");

  const [settings, reservation] = await Promise.all([
    getSettings(),
    prisma.reservation.findUniqueOrThrow({ where: { id }, include: { customer: true } }),
  ]);

  const hours = (reservation.startAt.getTime() - now().getTime()) / 3_600_000;
  const policy = resolveCancelPolicy(settings, hours);
  const cancelFee = Math.floor((reservation.totalPrice * policy.feeRate) / 100);

  await notifyCancelled(id, policy.feeRate, cancelFee);

  await prisma.reservation.update({
    where: { id },
    data: {
      status: by === "owner" ? "cancelled_by_owner" : "cancelled_by_customer",
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelFee,
      isException: reservation.recurringRuleId ? true : reservation.isException,
    },
  });

  await deleteReservationFromCalendar(id);

  await prisma.reservationLog.create({
    data: {
      reservationId: id,
      actorType: by === "owner" ? "owner" : "customer",
      actorName: by === "owner" ? "オーナー" : reservation.customer.name,
      action: "キャンセル",
      detail: `${policy.feeRate}%のキャンセル料 (${cancelFee}円) / 理由: ${reason || "なし"}`,
    },
  });

  refresh();
}

export async function rescheduleReservation(formData: FormData) {
  const id = String(formData.get("reservationId"));
  const dateStr = String(formData.get("date"));
  const time = String(formData.get("time"));
  const by = String(formData.get("by") ?? "customer");

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id },
    include: { customer: true },
  });

  const beforeLabel = formatRange(reservation.startAt, reservation.endAt);
  const start = jst(dateStr, time);

  await prisma.reservation.update({
    where: { id },
    data: {
      startAt: start,
      endAt: addMinutes(start, reservation.totalMinutes),
      // 定期から生成された回を個別に動かしたら、以降のルール変更から保護する
      isException: reservation.recurringRuleId ? true : reservation.isException,
    },
  });

  await syncReservationToCalendar(id);
  await notifyRescheduled(id, beforeLabel);

  await prisma.reservationLog.create({
    data: {
      reservationId: id,
      actorType: by === "owner" ? "owner" : "customer",
      actorName: by === "owner" ? "オーナー" : reservation.customer.name,
      action: "日時を変更",
      detail: `${beforeLabel} → ${dateStr} ${time}`,
    },
  });

  refresh();
}

/** 訪問 ⇄ オンラインの切替 */
export async function switchDeliveryType(formData: FormData) {
  const id = String(formData.get("reservationId"));
  const targetMenuId = String(formData.get("targetMenuId"));

  const [reservation, menu] = await Promise.all([
    prisma.reservation.findUniqueOrThrow({ where: { id }, include: { customer: true } }),
    prisma.menu.findUniqueOrThrow({ where: { id: targetMenuId } }),
  ]);

  const start = reservation.startAt;
  await prisma.reservation.update({
    where: { id },
    data: {
      menuId: menu.id,
      deliveryType: menu.deliveryType,
      totalMinutes: menu.durationMinutes,
      totalPrice: menu.price,
      endAt: addMinutes(start, menu.durationMinutes),
      serviceAddress:
        menu.deliveryType === "visit"
          ? [reservation.customer.address, reservation.customer.buildingName].filter(Boolean).join(" ")
          : null,
      meetingUrl: null,
      isException: reservation.recurringRuleId ? true : reservation.isException,
    },
  });

  // カレンダーを更新する。オンラインになった場合はここで会議URLが発行される。
  await syncReservationToCalendar(id);
  await notifyRescheduled(id, `${reservation.deliveryType === "visit" ? "訪問" : "オンライン"}での実施`);

  await prisma.reservationLog.create({
    data: {
      reservationId: id,
      actorType: "owner",
      actorName: "オーナー",
      action: "提供形態を変更",
      detail: `${reservation.deliveryType === "visit" ? "訪問" : "オンライン"} → ${menu.deliveryType === "visit" ? "訪問" : "オンライン"}（${menu.name}）`,
    },
  });

  refresh();
}

export async function completeReservation(formData: FormData) {
  const id = String(formData.get("reservationId"));
  const paymentStatus = String(formData.get("paymentStatus") ?? "cash_received");

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: "completed", paymentStatus },
    include: { customer: true },
  });

  await prisma.reservationLog.create({
    data: { reservationId: id, actorType: "owner", actorName: "オーナー", action: "実施済みにする" },
  });

  await notifyCompleted(id);

  // 入金済みなら入金の仕訳を起こす
  if (paymentStatus !== "unpaid") {
    await ensureChartOfAccounts();
    await journalizePayment({
      reservationId: id,
      date: toDateStr(reservation.startAt),
      amount: reservation.totalPrice,
      method: paymentStatus === "cash_received" ? "cash" : "bank_transfer",
      customerName: reservation.customer.name,
    });
  }

  refresh();
}

export async function createBlockedSlot(formData: FormData) {
  const owner = await getOwner();
  const dateStr = String(formData.get("date"));
  const time = String(formData.get("time"));
  const minutes = Number(formData.get("minutes") ?? 60);
  const title = String(formData.get("title") ?? "ブロック枠");

  const start = jst(dateStr, time);
  await prisma.blockedSlot.create({
    data: { staffId: owner.id, startAt: start, endAt: addMinutes(start, minutes), title },
  });
  refresh();
}

/* ---------------- 定期予約 ---------------- */

export async function createRecurringRule(formData: FormData) {
  const owner = await getOwner();
  const customerId = String(formData.get("customerId"));
  const menuId = String(formData.get("menuId"));
  const frequency = String(formData.get("frequency"));
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const nthWeek = formData.get("nthWeek") ? Number(formData.get("nthWeek")) : null;
  const startTime = String(formData.get("startTime"));
  const startDate = String(formData.get("startDate"));

  const menu = await prisma.menu.findUniqueOrThrow({ where: { id: menuId } });

  const rule = await prisma.recurringRule.create({
    data: {
      customerId,
      staffId: owner.id,
      menuId,
      frequency,
      dayOfWeek,
      nthWeek,
      startTime,
      durationMinutes: menu.durationMinutes,
      startDate,
      status: "active",
    },
  });

  const result = await generateOccurrences(rule.id);

  // 生成した各回をカレンダーへ書き出す
  const created = await prisma.reservation.findMany({
    where: { recurringRuleId: rule.id, status: "confirmed" },
    select: { id: true },
    take: 20,
  });
  for (const r of created) await syncReservationToCalendar(r.id);

  void result;
  refresh();
  redirect(`/liff/recurring?created=1`);
}

export async function skipOccurrence(formData: FormData) {
  const id = String(formData.get("reservationId"));
  await notifySkipped(id);
  await prisma.reservation.update({
    where: { id },
    data: { status: "skipped", isException: true, cancelledAt: new Date() },
  });
  await deleteReservationFromCalendar(id);
  await prisma.reservationLog.create({
    data: {
      reservationId: id,
      actorType: "customer",
      actorName: "お客様",
      action: "この回だけスキップ",
      detail: "定期ルールは継続",
    },
  });
  refresh();
}

export async function changeRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId"));
  const effectiveFrom = String(formData.get("effectiveFrom"));
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime"));

  await applyRuleChange(ruleId, effectiveFrom, { dayOfWeek, startTime });

  const created = await prisma.reservation.findMany({
    where: { recurringRuleId: ruleId, status: "confirmed" },
    select: { id: true },
    take: 20,
  });
  for (const r of created) await syncReservationToCalendar(r.id);

  refresh();
}

export async function pauseRuleAction(formData: FormData) {
  await pauseRule(
    String(formData.get("ruleId")),
    String(formData.get("from")),
    String(formData.get("to"))
  );
  refresh();
}

export async function resumeRuleAction(formData: FormData) {
  await resumeRule(String(formData.get("ruleId")));
  refresh();
}

export async function endRuleAction(formData: FormData) {
  await endRule(String(formData.get("ruleId")), String(formData.get("endDate") || todayStr()));
  refresh();
}

export async function regenerateRuleAction(formData: FormData) {
  await generateOccurrences(String(formData.get("ruleId")));
  refresh();
}

/* ---------------- インボイス ---------------- */

export type InvoiceActionState = { error?: string; errors?: string[]; ok?: string };

export async function issueInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const customerId = String(formData.get("customerId"));
  const reservationIds = formData.getAll("reservationIds").map(String).filter(Boolean);
  const type = String(formData.get("type") ?? "receipt") as "invoice" | "receipt";

  if (reservationIds.length === 0) {
    return { error: "どのお仕事の領収書を出すか、えらんでください" };
  }

  try {
    const invoice = await issueInvoice({ customerId, reservationIds, type });
    await ensureChartOfAccounts();
    await journalizeInvoice(invoice.id);
    refresh();
    return { ok: `${invoice.invoiceNumber} を発行し、売上の仕訳を起こしました` };
  } catch (e) {
    if (e instanceof InvoiceValidationError) {
      return {
      error: "法律で必要な項目が足りないため、まだ出せません。下の点をご確認ください。",
      errors: e.errors,
    };
    }
    return { error: e instanceof Error ? e.message : "うまく出せませんでした。もう一度お試しください。" };
  }
}

/** PDFを生成し、LINEで送付する */
export async function sendInvoiceByLineAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId"));
  try {
    await generateInvoicePdf(invoiceId);
  } catch {
    // PDF生成に失敗しても通知は送る（URLからその場で生成できるため）
  }
  await notifyInvoiceIssued(invoiceId);
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "sent", sentAt: new Date(), sentVia: "line" },
  });
  refresh();
}

export async function voidInvoiceAction(formData: FormData) {
  await voidInvoice(String(formData.get("invoiceId")), String(formData.get("reason") || "理由未入力"));
  refresh();
}

export async function issueReturnedInvoiceAction(formData: FormData) {
  const { invoice } = await issueReturnedInvoice(
    String(formData.get("invoiceId")),
    Number(formData.get("amount") ?? 0),
    String(formData.get("description") || "キャンセル料の返還")
  );
  await ensureChartOfAccounts();
  await journalizeInvoice(invoice.id);
  refresh();
}

/* ---------------- Googleカレンダー ---------------- */

export async function syncAllCalendarAction() {
  await syncAllReservations();
  refresh();
}

export async function importCalendarAction() {
  const from = jst(todayStr(), "00:00");
  const to = jst(addDays(todayStr(), 60), "00:00");
  await importPersonalEventsAsBlocks(from, to);
  refresh();
}

export async function retrySyncAction() {
  await retryFailedSyncs();
  refresh();
}

export async function driftCheckAction() {
  await detectAndRepairDrift();
  refresh();
}

/** デモ用: Google側で予定が消された状況を作る（不整合の検知を試すため） */
export async function simulateExternalDeleteAction(formData: FormData) {
  const googleEventId = String(formData.get("googleEventId"));
  await prisma.calendarEvent.updateMany({
    where: { googleEventId },
    data: { isDeleted: true },
  });
  refresh();
}

/** デモ用: Google側に私用予定を1件足す（取り込みを試すため） */
export async function simulatePersonalEventAction(formData: FormData) {
  const date = String(formData.get("date"));
  const time = String(formData.get("time"));
  const minutes = Number(formData.get("minutes") ?? 90);
  const summary = String(formData.get("summary") || "私用（Googleカレンダー側で登録）");

  const start = jst(date, time);
  await prisma.calendarEvent.create({
    data: {
      googleEventId: `mock_personal_${Date.now()}`,
      summary,
      startAt: start,
      endAt: addMinutes(start, minutes),
      source: "personal",
    },
  });
  refresh();
}

/* ---------------- LINE ---------------- */

export async function publishRichMenuAction(formData: FormData) {
  const id = String(formData.get("richMenuId"));
  const menu = await prisma.richMenu.findUniqueOrThrow({ where: { id } });
  const areas = JSON.parse(menu.areas) as { label: string; icon: string; path: string }[];

  const payload = buildRichMenuPayload({
    name: menu.name,
    chatBarText: menu.chatBarText,
    areas,
    liffBaseUrl: process.env.LIFF_BASE_URL ?? "https://example.com/liff",
  });

  const { richMenuId } = await registerRichMenu(payload);

  await prisma.richMenu.updateMany({ where: { target: menu.target }, data: { isPublished: false } });
  await prisma.richMenu.update({
    where: { id },
    data: { isPublished: true, lineRichMenuId: richMenuId },
  });

  // 対象の顧客にリンクする
  const customers = await prisma.customer.findMany({ select: { lineUserId: true } });
  for (const c of customers) await linkRichMenuToUser(c.lineUserId, richMenuId);

  refresh();
}

/** デモ用: LINEからのWebhookを疑似的に流し込む */
export async function simulateWebhookAction(formData: FormData) {
  const type = String(formData.get("eventType"));
  const lineUserId = String(formData.get("lineUserId"));
  const text = String(formData.get("text") ?? "");

  const body = {
    events: [
      {
        type,
        webhookEventId: `demo-${type}-${Date.now()}`,
        timestamp: Date.now(),
        source: { userId: lineUserId, type: "user" },
        ...(type === "message" ? { message: { type: "text", text } } : {}),
        ...(type === "postback" ? { postback: { data: text } } : {}),
      },
    ],
  };

  const base = process.env.APP_BASE_URL ?? "http://127.0.0.1:3000";
  await fetch(`${base}/api/line/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  refresh();
}

/** 前日リマインドのバッチを手動で走らせる */
export async function runReminderBatchAction() {
  const target = addDays(todayStr(), 1);
  const from = jst(target, "00:00");
  const to = jst(addDays(target, 1), "00:00");

  const reservations = await prisma.reservation.findMany({
    where: { status: "confirmed", startAt: { gte: from, lt: to } },
    select: { id: true },
  });
  for (const r of reservations) await notifyReminder(r.id);
  refresh();
}

/** オンライン開始直前リマインドのバッチ */
export async function runOnlineReminderBatchAction() {
  const settings = await getSettings();
  const soon = new Date(now().getTime() + settings.onlineReminderMinutes * 60_000);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      deliveryType: "online",
      startAt: { gte: now(), lte: soon },
    },
    select: { id: true },
  });
  for (const r of reservations) await notifyOnlineSoon(r.id);
  refresh();
}

/* ---------------- 経費・OCR ---------------- */

export type OcrState = {
  error?: string;
  parsed?: {
    vendorName: string;
    transactionDate: string | null;
    totalAmount: number | null;
    registrationNumber: string | null;
    taxRate: number;
    hasQualifiedInvoice: boolean;
    rawText: string;
    suggestedAccountCode: string;
    smallAmountException: boolean;
  };
};

export async function ocrReceiptAction(_prev: OcrState, formData: FormData): Promise<OcrState> {
  const sampleKey = String(formData.get("sampleKey") ?? "homecenter");
  const file = formData.get("file");

  try {
    let base64 = "";
    if (file instanceof File && file.size > 0) {
      base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }
    const text = await runOcr(base64, sampleKey);
    const parsed = parseReceipt(text);

    return {
      parsed: {
        ...parsed,
        suggestedAccountCode: suggestAccountCode(parsed),
        smallAmountException: parsed.totalAmount
          ? isSmallAmountException(parsed.totalAmount)
          : false,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "うまく読み取れませんでした。もう一度お試しください。" };
  }
}

export async function createExpenseAction(formData: FormData) {
  await ensureChartOfAccounts();

  const expenseDate = String(formData.get("expenseDate"));
  const amount = Number(formData.get("amount"));
  const accountCode = String(formData.get("accountCode"));
  const vendorName = String(formData.get("vendorName"));
  const vendorRegistrationNumber = String(formData.get("vendorRegistrationNumber") ?? "") || null;
  const taxCategory = String(formData.get("taxCategory") ?? "課税10");
  const invoiceStatus = String(formData.get("invoiceStatus") ?? "qualified");
  const ocrRawText = String(formData.get("ocrRawText") ?? "");
  const note = String(formData.get("note") ?? "");

  // 証憑として登録する（電子帳簿保存法の検索要件3項目を必ず入れる）
  const document = await prisma.document.create({
    data: {
      kind: "received_receipt",
      filePath: `storage/receipts/${expenseDate}-${vendorName}.txt`,
      mimeType: "text/plain",
      transactionDate: expenseDate,
      transactionAmount: amount,
      counterpartyName: vendorName,
      retentionUntil: addDays(expenseDate, 365 * 7),
    },
  });
  await prisma.documentLog.create({
    data: { documentId: document.id, action: "create", detail: "レシートを登録" },
  });

  const expense = await prisma.expense.create({
    data: {
      expenseDate,
      accountCode,
      amount,
      taxCategory,
      vendorName,
      vendorRegistrationNumber,
      invoiceStatus,
      documentId: document.id,
      ocrRawText,
      note,
    },
  });

  await journalizeExpense(expense.id);
  refresh();
}

export async function deleteDocumentAction(formData: FormData) {
  const id = String(formData.get("documentId"));
  const reason = String(formData.get("reason") ?? "");
  const doc = await prisma.document.findUniqueOrThrow({ where: { id } });

  // 保存期限内は削除できない（電子帳簿保存法）
  if (doc.retentionUntil >= todayStr()) {
    await prisma.documentLog.create({
      data: {
        documentId: id,
        action: "logical_delete",
        detail: `削除を拒否（保存期限 ${doc.retentionUntil} まで削除できません）`,
      },
    });
    refresh();
    return;
  }

  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.documentLog.create({
    data: { documentId: id, action: "logical_delete", detail: reason },
  });
  refresh();
}

/* ---------------- 決算 ---------------- */

export async function runDepreciationAction(formData: FormData) {
  await ensureChartOfAccounts();
  const fiscalYearId = String(formData.get("fiscalYearId"));
  await runDepreciation(fiscalYearId);
  refresh();
}

export async function ensureFiscalYearAction() {
  await ensureChartOfAccounts();
  await ensureFiscalYear();
  refresh();
}

/* ---------------- 設定 ---------------- */

export async function updateSettingsAction(formData: FormData) {
  const num = (k: string) => Number(formData.get(k));
  await saveSettings({
    issuerName: String(formData.get("issuerName")),
    registrationNumber: String(formData.get("registrationNumber")),
    fiscalYearEndMonth: num("fiscalYearEndMonth"),
    taxMethod: String(formData.get("taxMethod")) as "honsoku" | "kani",
    roundingMode: String(formData.get("roundingMode")) as "floor" | "ceil" | "round",
    baseAddress: String(formData.get("baseAddress")),
    travelBuffer: {
      visit_visit: num("visit_visit"),
      visit_online: num("visit_online"),
      online_visit: num("online_visit"),
      online_online: num("online_online"),
    },
    prepBeforeMinutes: num("prepBeforeMinutes"),
    prepAfterMinutes: num("prepAfterMinutes"),
    cutoffHours: { visit: num("cutoff_visit"), online: num("cutoff_online") },
    maxPerDay: { visit: num("max_visit"), online: num("max_online") },
    bookingWindowDays: num("bookingWindowDays"),
    serviceAreas: String(formData.get("serviceAreas"))
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  });
  refresh();
}
