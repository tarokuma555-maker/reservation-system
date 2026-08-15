"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";

/**
 * お客様ご自身による、ご登録内容の更新。
 *
 * 更新先はフォームから来たIDではなく、確認できたご本人に限る。
 * IDを受け取る作りにすると、他の方の情報を書き換えられてしまう。
 */

export type ProfileState = { ok?: string; error?: string };

export async function saveMyProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: "お客様の確認ができませんでした。LINEのメニューからもう一度お開きください。" };
  }

  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const postalCode = str(formData, "postalCode");
  const address = str(formData, "address");
  const buildingName = str(formData, "buildingName");
  const layout = str(formData, "layout");
  const keyHandover = str(formData, "keyHandover");
  const hasPet = formData.get("hasPet") === "on";

  if (!name) return { error: "お名前をご入力ください。" };

  // 訪問のご予約には住所と電話番号が要る。片方だけでは伺えない。
  if (address && !phone) {
    return { error: "ご住所をご登録いただく場合は、お電話番号もあわせてご入力ください。" };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name,
      phone,
      postalCode: postalCode || null,
      address: address || null,
      buildingName: buildingName || null,
      layout: layout || null,
      keyHandover: keyHandover || null,
      hasPet,
    },
  });

  revalidatePath("/liff", "layout");
  return { ok: "ご登録ありがとうございます。" };
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
