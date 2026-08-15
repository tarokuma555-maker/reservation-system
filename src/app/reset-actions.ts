"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { clearDemoData, CONFIRM_PHRASE } from "@/lib/reset";

/**
 * デモのデータを消す操作。
 *
 * 取り消しができないので、ボタンひとつでは実行しない。
 * 決まった言葉を打ち込んでもらって、はじめて動く形にしている。
 */

export type ResetState = { ok?: string; error?: string };

export async function clearDemoDataAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const staff = await requireStaff();

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== CONFIRM_PHRASE) {
    return {
      error: `確認の言葉が違います。「${CONFIRM_PHRASE}」と、そのまま打ち込んでください。`,
    };
  }

  const deleteMenus = formData.get("deleteMenus") === "on";
  const before = await clearDemoData({ deleteMenus });

  revalidatePath("/admin", "layout");
  revalidatePath("/liff", "layout");

  const parts = [
    `お客様 ${before.customers}名`,
    `ご予約 ${before.reservations}件`,
    `定期 ${before.recurringRules}組`,
    `領収書 ${before.invoices}件`,
    `帳簿 ${before.journalEntries}件`,
  ];
  if (deleteMenus) parts.push(`メニュー ${before.menus}件`);

  return {
    ok: `消しました（${parts.join(" / ")}）。ここから本番です。${staff.name}さんの操作として記録しました。`,
  };
}
