import { createHash } from "node:crypto";
import { prisma } from "./db";
import { addDays } from "./time";
import { loadInvoiceDocument } from "./invoice-view";
import InvoiceDocument from "@/components/InvoiceDocument";
import { archiveStylesheet } from "./archive-style";

/**
 * 交付した書類の控えを残す。
 *
 * 電子帳簿保存法では、交付した書類の写しを7年保存する必要がある。
 * LINEでお渡ししている以上これは電子取引なので、紙ではなくデータで残す。
 *
 * かつては「PDFを作ったときに控えも作る」形だった。ところが本番の置き場所には
 * 日本語を描けるブラウザが無くPDFを作れず、**控えが1件も残っていなかった**。
 * 発行そのものと控えの保存を切り離し、発行した時点で必ず残るようにしている。
 *
 * 中身はDBに置く。サーバーレスではファイルが消えるため、
 * 別のサービスを増やさずに確実に残せる置き場所がここしかない。
 * 書類1枚あたり数KBなので、量としても無理がない。
 */

export const RETENTION_YEARS = 7;

/**
 * 発行した書類の控えを作る。
 *
 * すでに控えがあれば作り直さない。交付したものは後から変えてはいけないため、
 * 二重に作ったり上書きしたりしない。
 */
export async function archiveIssuedInvoice(invoiceId: string): Promise<{ documentId: string; created: boolean }> {
  const existing = await prisma.document.findFirst({
    where: { kind: "issued_invoice", invoiceId },
  });
  if (existing) return { documentId: existing.id, created: false };

  const doc = await loadInvoiceDocument(invoiceId);
  if (!doc) throw new Error("控えを作る書類が見つかりませんでした");

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: true },
  });

  const html = await renderArchiveHtml(doc);
  const hash = createHash("sha256").update(html, "utf8").digest("hex");

  // 検索要件3項目。取引年月日は明細の日付を優先する（発行日とずれることがある）
  const transactionDate = invoice.lines[0]?.transactionDate ?? invoice.issueDate;

  const document = await prisma.document.create({
    data: {
      kind: "issued_invoice",
      invoiceId,
      filePath: null,
      content: html,
      mimeType: "text/html",
      fileHash: hash,
      transactionDate,
      transactionAmount: invoice.totalAmount,
      counterpartyName: invoice.recipientName,
      retentionUntil: addDays(invoice.issueDate, 365 * RETENTION_YEARS),
    },
  });

  await prisma.documentLog.create({
    data: {
      documentId: document.id,
      action: "create",
      detail: `${invoice.invoiceNumber} の控えを保存（${RETENTION_YEARS}年）`,
    },
  });

  return { documentId: document.id, created: true };
}

/**
 * 控えとして残すHTML。
 *
 * あとから開いても当時の見た目のままになるよう、体裁も一緒に埋め込む。
 * 外の読み込みに頼ると、その先が変わったときに見た目が変わってしまう。
 */
async function renderArchiveHtml(doc: Parameters<typeof InvoiceDocument>[0]): Promise<string> {
  // react-dom/server は必要になったときだけ読む。
  // 先に読み込む形にすると、ブラウザ側の束にまで引きずられる。
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(InvoiceDocument(doc));
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.invoiceNumber)}</title>
<style>${archiveStylesheet()}</style>
</head><body>${body}</body></html>`;
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

/**
 * 控えがまだ無い発行済みの書類をさがす。
 *
 * 「PDFを作ったときに控えも作る」形だった頃に発行したぶんは、控えが残っていない。
 * それが何件あるかを画面に出し、あとから埋められるようにするために使う。
 */
export async function findInvoicesWithoutArchive(): Promise<
  { id: string; invoiceNumber: string }[]
> {
  const archived = await prisma.document.findMany({
    where: { kind: "issued_invoice", invoiceId: { not: null } },
    select: { invoiceId: true },
  });
  const done = new Set(archived.map((d) => d.invoiceId));

  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "asc" },
    select: { id: true, invoiceNumber: true },
  });
  return invoices.filter((i) => !done.has(i.id));
}

/** 保存されている控えが、作った当時から変わっていないか確かめる */
export function verifyArchive(content: string, fileHash: string): boolean {
  return createHash("sha256").update(content, "utf8").digest("hex") === fileHash;
}
