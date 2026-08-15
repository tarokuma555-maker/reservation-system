"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

/**
 * メニューと、追加でえらべるものの出し入れ。
 *
 * これが無いと、デモの料金表を消したあとに1件も登録できず、
 * お客様がメニューを選べないままになる。
 */

export type MenuState = { ok?: string; error?: string };

const DELIVERY = ["visit", "online"] as const;

function readMenu(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deliveryType = String(formData.get("deliveryType") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes"));
  const price = Number(formData.get("price"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!name) return { error: "メニューの名前を入れてください。" as const };
  if (!category) return { error: "分類を入れてください（例: おそうじ）。" as const };
  if (!DELIVERY.includes(deliveryType as (typeof DELIVERY)[number])) {
    return { error: "ご利用方法をえらんでください。" as const };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "かかる時間を、1以上の数字で入れてください。" as const };
  }
  if (!Number.isFinite(price) || price < 0) {
    return { error: "いただく金額を、0以上の数字で入れてください。" as const };
  }

  return {
    data: {
      name,
      category,
      description,
      deliveryType,
      durationMinutes: Math.round(durationMinutes),
      price: Math.round(price),
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
      taxRate: 10,
      isPublished: formData.get("isPublished") === "on",
      isRecurringOnly: formData.get("isRecurringOnly") === "on",
      isFirstTimeOnly: formData.get("isFirstTimeOnly") === "on",
      applyLayoutAdjust: formData.get("applyLayoutAdjust") === "on",
    },
  };
}

export async function createMenuAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();
  const parsed = readMenu(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.menu.create({ data: parsed.data });
  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return { ok: `「${parsed.data.name}」を追加しました。` };
}

export async function updateMenuAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どのメニューか分かりませんでした。" };

  const parsed = readMenu(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.menu.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return { ok: "保存しました。" };
}

/**
 * メニューを消す。
 * すでにご予約で使われている場合は消さず、「出さない」に切り替える。
 * 消してしまうと、過去のご予約から何のお仕事だったのかが辿れなくなる。
 */
export async function deleteMenuAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どのメニューか分かりませんでした。" };

  const menu = await prisma.menu.findUnique({ where: { id } });
  if (!menu) return { error: "そのメニューは見つかりませんでした。" };

  const used = await prisma.reservation.count({ where: { menuId: id } });
  if (used > 0) {
    await prisma.menu.update({ where: { id }, data: { isPublished: false } });
    revalidatePath("/admin/menus");
    revalidatePath("/liff", "layout");
    return {
      ok: `「${menu.name}」はご予約${used}件で使われているため、消さずに「出さない」に切り替えました。`,
    };
  }

  await prisma.menuOption.deleteMany({ where: { menuId: id } });
  await prisma.menu.delete({ where: { id } });

  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return { ok: `「${menu.name}」を消しました。` };
}

/** 一覧から、出す・出さないだけを切り替える */
export async function toggleMenuPublishedAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どのメニューか分かりませんでした。" };

  const menu = await prisma.menu.findUnique({ where: { id } });
  if (!menu) return { error: "そのメニューは見つかりませんでした。" };

  const next = !menu.isPublished;
  await prisma.menu.update({ where: { id }, data: { isPublished: next } });
  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return {
    ok: next
      ? `「${menu.name}」をお客様の画面に出しました。`
      : `「${menu.name}」を、お客様の画面に出さないようにしました。`,
  };
}

/* ---------------- 追加でえらべるもの ---------------- */

export async function saveOptionAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const additionalMinutes = Number(formData.get("additionalMinutes") ?? 0);
  const additionalPrice = Number(formData.get("additionalPrice") ?? 0);

  if (!name) return { error: "内容を入れてください。" };
  if (!Number.isFinite(additionalMinutes) || additionalMinutes < 0) {
    return { error: "増える時間を、0以上の数字で入れてください。" };
  }
  if (!Number.isFinite(additionalPrice) || additionalPrice < 0) {
    return { error: "増える金額を、0以上の数字で入れてください。" };
  }

  const data = {
    name,
    additionalMinutes: Math.round(additionalMinutes),
    additionalPrice: Math.round(additionalPrice),
  };

  if (id) {
    await prisma.menuOption.update({ where: { id }, data });
  } else {
    await prisma.menuOption.create({ data: { ...data, menuId: null } });
  }

  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return { ok: id ? "保存しました。" : `「${name}」を追加しました。` };
}

export async function deleteOptionAction(
  _prev: MenuState,
  formData: FormData
): Promise<MenuState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どれか分かりませんでした。" };

  const option = await prisma.menuOption.findUnique({ where: { id } });
  if (!option) return { error: "見つかりませんでした。" };

  const used = await prisma.reservationOption.count({ where: { optionId: id } });
  if (used > 0) {
    await prisma.menuOption.update({ where: { id }, data: { isPublished: false } });
    revalidatePath("/admin/menus");
    revalidatePath("/liff", "layout");
    return { ok: `「${option.name}」はご予約で使われているため、出さないようにしました。` };
  }

  await prisma.menuOption.delete({ where: { id } });
  revalidatePath("/admin/menus");
  revalidatePath("/liff", "layout");
  return { ok: `「${option.name}」を消しました。` };
}
