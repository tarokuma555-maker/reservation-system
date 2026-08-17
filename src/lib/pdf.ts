import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { resolveChromiumPath } from "./browser";

/**
 * 請求書PDFの生成。
 *
 * 印刷用HTML（/print/invoice/[id]）をヘッドレスChromiumで開いてPDF化する。
 * 日本語フォントの埋め込みをライブラリ側で用意しなくてよく、画面と紙の見た目が必ず一致する。
 *
 * ここで作るのは「お客様にお渡しするためのPDF」。
 * 法律で7年残す必要のある**控え**は、発行した時点で別に保存している
 * （src/lib/document-archive.ts）。この置き場所ではPDFを作れないことがあるため、
 * 控えの保存をPDF生成に頼らせない。
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

  // 控えの保存はここでは行わない。
  // 発行した時点で archiveIssuedInvoice が残している。
  // ここで作ると、PDFを開くたびに控えが増えてしまう。

  await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfPath: filePath } });

  return { filePath, regenerated: true };
}

export function readPdf(filePath: string): Buffer {
  return readFileSync(filePath);
}
