import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { resolveChromiumPath } from "./browser";
import { addDays } from "./time";

/**
 * 請求書PDFの生成。
 *
 * 印刷用HTML（/print/invoice/[id]）をヘッドレスChromiumで開いてPDF化する。
 * 日本語フォントの埋め込みをライブラリ側で用意しなくてよく、画面と紙の見た目が必ず一致する。
 *
 * 生成したPDFは storage/invoices/ に保存し、Document（証憑）として登録する。
 * 証憑には電子帳簿保存法の検索要件3項目（取引年月日・取引金額・取引先）を必ず入れる。
 */

// 書き込み可能な場所に置く。サーバーレスでは /tmp しか書けない。
const STORAGE_DIR = process.env.VERCEL
  ? "/tmp/invoices"
  : path.join(process.cwd(), "storage", "invoices");

export function invoicePdfPath(invoiceNumber: string): string {
  return path.join(STORAGE_DIR, `${invoiceNumber}.pdf`);
}

export async function generateInvoicePdf(invoiceId: string): Promise<{ filePath: string; regenerated: boolean }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { customer: true, lines: true },
  });

  const filePath = invoicePdfPath(invoice.invoiceNumber);
  if (invoice.pdfPath && existsSync(filePath)) {
    return { filePath, regenerated: false };
  }

  mkdirSync(STORAGE_DIR, { recursive: true });

  const baseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:3000";
  const url = `${baseUrl}/print/invoice/${invoice.id}`;

  const { chromium } = await import("playwright");
  const executablePath = resolveChromiumPath();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.emulateMedia({ media: "print" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    writeFileSync(filePath, buffer);
  } finally {
    await browser.close();
  }

  const hash = createHash("sha256").update(readFileSync(filePath)).digest("hex");

  // 交付した書類の写しを証憑として保存する（保存期間は7年）
  const retentionUntil = addDays(invoice.issueDate, 365 * 7);
  const document = await prisma.document.create({
    data: {
      kind: "issued_invoice",
      filePath,
      mimeType: "application/pdf",
      fileHash: hash,
      transactionDate: invoice.lines[0]?.transactionDate ?? invoice.issueDate,
      transactionAmount: invoice.totalAmount,
      counterpartyName: invoice.recipientName,
      retentionUntil,
    },
  });
  await prisma.documentLog.create({
    data: {
      documentId: document.id,
      action: "create",
      detail: `${invoice.invoiceNumber} のPDFを生成し、写しとして保存`,
    },
  });

  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfPath: filePath } });

  return { filePath, regenerated: true };
}

export function readPdf(filePath: string): Buffer {
  return readFileSync(filePath);
}
