"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

/**
 * お客様の登録・修正。
 *
 * LINEから来られた方は自動で登録されるが、電話や紹介のお客様は
 * こちらから入れる必要がある。これが無いと、LINEを使わない方は
 * システムに存在できず、ご予約も帳簿も残せない。
 */

export type CustomerState = { ok?: string; error?: string; customerId?: string };

function read(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) return { error: "お名前を入れてください。" as const };

  // 訪問のご予約には住所と電話が要る。片方だけだと当日に困る。
  if (address && !phone) {
    return { error: "ご住所を入れる場合は、お電話番号もお願いします。" as const };
  }

  return {
    data: {
      name,
      nameKana: String(formData.get("nameKana") ?? "").trim(),
      phone,
      email: str(formData, "email"),
      postalCode: str(formData, "postalCode"),
      address: address || null,
      buildingName: str(formData, "buildingName"),
      layout: str(formData, "layout"),
      keyHandover: str(formData, "keyHandover"),
      companyName: str(formData, "companyName"),
      hasPet: formData.get("hasPet") === "on",
      note: String(formData.get("note") ?? "").trim(),
    },
  };
}

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

export async function createCustomerAction(
  _prev: CustomerState,
  formData: FormData
): Promise<CustomerState> {
  await requireStaff();
  const parsed = read(formData);
  if ("error" in parsed) return { error: parsed.error };

  // LINEを使わないお客様は lineUserId を持たない。
  // 空どうしは重複と見なされないので、何人でも登録できる。
  const customer = await prisma.customer.create({
    data: { ...parsed.data, lineUserId: null, tags: "電話・紹介" },
  });

  revalidatePath("/admin/customers");
  return { ok: `「${customer.name}」を登録しました。`, customerId: customer.id };
}

export async function updateCustomerAction(
  _prev: CustomerState,
  formData: FormData
): Promise<CustomerState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どのお客様か分かりませんでした。" };

  const parsed = read(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.customer.update({ where: { id }, data: parsed.data });

  revalidatePath("/admin/customers");
  revalidatePath("/liff", "layout");
  return { ok: "保存しました。", customerId: id };
}
