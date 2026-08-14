"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEMO_CUSTOMER_COOKIE, getOwner } from "@/lib/session";
import { getSettings, resolveCancelPolicy, saveSettings } from "@/lib/settings";
import { addMinutes, jst, now, toDateStr } from "@/lib/time";
import { layoutAdjustment } from "@/lib/availability";
import { applyRuleChange, endRule, generateOccurrences, pauseRule, resumeRule } from "@/lib/recurring";
import { issueInvoice, issueReturnedInvoice, voidInvoice, InvoiceValidationError } from "@/lib/invoice";

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

  const adjust = layoutAdjustment(settings, menu.deliveryType as "visit" | "online", menu.applyLayoutAdjust, customer.layout);
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
      meetingUrl:
        menu.deliveryType === "online"
          ? `https://meet.google.com/demo-${dateStr.replace(/-/g, "")}-${time.replace(":", "")}`
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

  const before = `${toDateStr(reservation.startAt)} ${reservation.startAt.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })}`;
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

  await prisma.reservationLog.create({
    data: {
      reservationId: id,
      actorType: by === "owner" ? "owner" : "customer",
      actorName: by === "owner" ? "オーナー" : reservation.customer.name,
      action: "日時を変更",
      detail: `${before} → ${dateStr} ${time}`,
    },
  });

  refresh();
}

/** 訪問 ⇄ オンラインの切替（当日の体調不良などで振り替える） */
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
      meetingUrl:
        menu.deliveryType === "online"
          ? `https://meet.google.com/demo-${id.slice(0, 8)}`
          : null,
      isException: reservation.recurringRuleId ? true : reservation.isException,
    },
  });

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

  await prisma.reservation.update({
    where: { id },
    data: { status: "completed", paymentStatus },
  });
  await prisma.reservationLog.create({
    data: { reservationId: id, actorType: "owner", actorName: "オーナー", action: "実施済みにする" },
  });
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

  await generateOccurrences(rule.id);
  refresh();
  redirect(`/liff/recurring?created=1`);
}

/** 今回だけ休む（ルールは継続する） */
export async function skipOccurrence(formData: FormData) {
  const id = String(formData.get("reservationId"));
  await prisma.reservation.update({
    where: { id },
    data: { status: "skipped", isException: true, cancelledAt: new Date() },
  });
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
  await endRule(String(formData.get("ruleId")), String(formData.get("endDate") || toDateStr(now())));
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
  const type = (String(formData.get("type") ?? "receipt") as "invoice" | "receipt");

  if (reservationIds.length === 0) {
    return { error: "対象の予約を選んでください" };
  }

  try {
    const invoice = await issueInvoice({ customerId, reservationIds, type });
    refresh();
    return { ok: `${invoice.invoiceNumber} を発行しました（LINEへ自動送付）` };
  } catch (e) {
    if (e instanceof InvoiceValidationError) {
      return { error: "適格請求書の記載事項が不足しているため発行できません", errors: e.errors };
    }
    return { error: e instanceof Error ? e.message : "発行に失敗しました" };
  }
}

export async function voidInvoiceAction(formData: FormData) {
  await voidInvoice(String(formData.get("invoiceId")), String(formData.get("reason") || "理由未入力"));
  refresh();
}

export async function issueReturnedInvoiceAction(formData: FormData) {
  await issueReturnedInvoice(
    String(formData.get("invoiceId")),
    Number(formData.get("amount") ?? 0),
    String(formData.get("description") || "キャンセル料の返還")
  );
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
