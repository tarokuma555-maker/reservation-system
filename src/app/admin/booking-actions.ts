"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getOwner } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { layoutAdjustment } from "@/lib/availability";
import { addMinutes, formatRange, jst } from "@/lib/time";
import { syncReservationToCalendar } from "@/lib/google-calendar";
import { notifyBookingConfirmed } from "@/lib/notifications";

/**
 * お店の側から予約を入れる。
 *
 * 電話や紹介で受けたご予約を入れる口。お客様側の予約と違い、
 * 営業時間の外や締切を過ぎた時間でも入れられるようにしている。
 * 「今日の夕方、電話で頼まれた」を断れないと、実務で使えないため。
 *
 * ただし**他のご予約との重なりだけは必ず確かめる**。
 * 二重に受けてしまうと、当日どちらかに迷惑がかかる。
 */

export type BookingState = { ok?: string; error?: string; reservationId?: string };

export async function createReservationByOwnerAction(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const staff = await requireStaff();

  const customerId = String(formData.get("customerId") ?? "");
  const menuId = String(formData.get("menuId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const optionIds = formData.getAll("optionIds").map(String).filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();
  const force = formData.get("force") === "on";

  if (!customerId) return { error: "お客様をえらんでください。" };
  if (!menuId) return { error: "メニューをえらんでください。" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "日にちをえらんでください。" };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "時間をえらんでください。" };

  const [settings, owner, menu, customer] = await Promise.all([
    getSettings(),
    getOwner(),
    prisma.menu.findUnique({ where: { id: menuId } }),
    prisma.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!menu) return { error: "そのメニューは見つかりませんでした。" };
  if (!customer) return { error: "そのお客様は見つかりませんでした。" };

  // うかがうメニューなのに住所が無いと、当日どこへ行くか分からない
  if (menu.deliveryType === "visit" && !customer.address?.trim()) {
    return {
      error: `${customer.name}様のご住所が未登録です。先にお客様の情報にご住所を入れてください。`,
    };
  }

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

  // 重なりの確認。押しまちがいで二重に受けるのを防ぐ。
  const overlapping = await prisma.reservation.findFirst({
    where: {
      staffId: owner.id,
      status: "confirmed",
      startAt: { lt: end },
      endAt: { gt: start },
    },
    include: { customer: true, menu: true },
  });

  if (overlapping && !force) {
    return {
      error: `この時間には、すでに${overlapping.customer.name}様の「${overlapping.menu.name}」が入っています（${formatRange(overlapping.startAt, overlapping.endAt)}）。それでも入れる場合は、下の「重なっても入れる」にチェックしてください。`,
    };
  }

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
      customerNote: note,
      // どこから入った予約かを残す。あとで「電話が多い」といった見直しに使える。
      source: "owner",
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
      actorType: "owner",
      actorName: staff.name,
      action: "予約を作成（お店から）",
      detail: `${dateStr} ${time} / ${menu.name}${force && overlapping ? " ／ 重なりを承知で登録" : ""}`,
    },
  });

  await syncReservationToCalendar(reservation.id);
  // LINEをお使いのお客様にはお知らせが届く。お使いでなければ記録だけ残る。
  await notifyBookingConfirmed(reservation.id);

  revalidatePath("/admin", "layout");

  const sent = customer.lineUserId ? "LINEでお知らせを送りました。" : "";
  return {
    ok: `${customer.name}様のご予約を入れました（${formatRange(start, end)}）。${sent}`,
    reservationId: reservation.id,
  };
}
