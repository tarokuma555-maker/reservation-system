"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { archiveIssuedInvoice, findInvoicesWithoutArchive } from "@/lib/document-archive";

export type ArchiveState = { ok?: string; error?: string };

/**
 * 控えが残っていない発行済みの書類に、あとから控えを作る。
 *
 * 以前は「PDFを作ったときに控えも作る」形で、本番ではPDFを作れず
 * 控えが1件も残っていなかった。その期間に発行したぶんを埋めるための操作。
 *
 * 中身は発行時に確定した内容（金額・宛名・登録番号）から作るので、
 * あとから作っても当時のとおりになる。
 */
export async function backfillArchivesAction(
  _prev: ArchiveState,
  _formData: FormData
): Promise<ArchiveState> {
  await requireStaff();

  const missing = await findInvoicesWithoutArchive();

  if (missing.length === 0) {
    return { ok: "控えは、発行ぶんすべてに残っています。" };
  }

  const failed: string[] = [];
  let created = 0;
  for (const invoice of missing) {
    try {
      const r = await archiveIssuedInvoice(invoice.id);
      if (r.created) created++;
    } catch {
      failed.push(invoice.invoiceNumber);
    }
  }

  revalidatePath("/admin/documents");

  if (failed.length > 0) {
    return {
      error: `${created}件の控えを作りましたが、${failed.length}件は作れませんでした（${failed.slice(0, 5).join("、")}）。`,
    };
  }
  return { ok: `${created}件の控えを作りました。これで発行ぶんすべてに残っています。` };
}
