import { prisma } from "./db";
import { getSettings } from "./settings";
import { todayStr } from "./time";
import {
  calculateTax,
  isReturnedInvoiceRequired,
  TaxLine,
  validateQualifiedInvoice,
} from "./tax";

export class InvoiceValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" / "));
    this.name = "InvoiceValidationError";
  }
}

/** 請求書番号を採番する。欠番を作らないため連番で払い出す。 */
async function nextInvoiceNumber(prefix: string): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `${prefix}-` } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const lastSeq = last ? Number(last.invoiceNumber.split("-")[1]) : 0;
  return `${prefix}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export type IssueInvoiceInput = {
  customerId: string;
  reservationIds: string[];
  type?: "invoice" | "receipt";
  issueDate?: string;
};

/**
 * 予約から適格請求書（または領収書）を発行する。要件定義 付録C の手順どおりに実装している。
 *   1. 明細を作る（端数処理しない）
 *   2. 税率ごとに合計してから1回だけ端数処理する
 *   3. 法定6項目を検証し、欠けていれば発行しない
 *   4. 発行時点の登録番号・宛名をスナップショットで保存する
 */
export async function issueInvoice(input: IssueInvoiceInput) {
  const settings = await getSettings();

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("顧客が見つかりません");

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: input.reservationIds } },
    include: { menu: true, options: true },
  });
  if (reservations.length === 0) throw new Error("対象の予約がありません");

  // 1. 明細（税込単価のまま持つ）
  const lines: TaxLine[] = reservations.map((r) => ({
    description:
      r.menu.name + (r.options.length ? `（${r.options.map((o) => o.name).join("・")}）` : ""),
    transactionDate: r.occurrenceDate ?? isoDate(r.startAt),
    quantity: 1,
    unitPrice: r.totalPrice,
    taxRate: r.menu.taxRate,
    reservationId: r.id,
  }));

  // 2. 税率ごとに1回だけ端数処理
  const breakdown = calculateTax(lines, settings.roundingMode);

  // 3. 法定6項目の検証
  const recipientName = customer.companyName || `${customer.name} 様`;
  const errors = validateQualifiedInvoice({
    issuerName: settings.issuerName,
    registrationNumber: settings.registrationNumber,
    recipientName,
    lines,
    breakdown,
  });
  if (errors.length > 0) throw new InvoiceValidationError(errors);

  // 4. 発行
  const invoiceNumber = await nextInvoiceNumber(settings.invoiceNumberPrefix);
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      type: input.type ?? "receipt",
      customerId: customer.id,
      issueDate: input.issueDate ?? todayStr(),
      subtotalByTaxRate: JSON.stringify(breakdown.subtotalByTaxRate),
      taxByTaxRate: JSON.stringify(breakdown.taxByTaxRate),
      totalAmount: breakdown.totalAmount,
      registrationNumber: settings.registrationNumber, // 発行時点のスナップショット
      issuerName: settings.issuerName,
      recipientName,
      status: "issued",
      lines: {
        create: lines.map((l) => ({
          reservationId: l.reservationId ?? null,
          transactionDate: l.transactionDate,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.unitPrice * l.quantity,
          taxRate: l.taxRate,
          isReducedTaxRate: l.isReducedTaxRate ?? false,
        })),
      },
    },
    include: { lines: true, customer: true },
  });

  return invoice;
}

/** 発行済み請求書を無効化する（削除はしない＝欠番を作らない） */
export async function voidInvoice(invoiceId: string, reason: string) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "void", voidReason: reason },
  });
}

/** 修正インボイスを発行する（元の書類は残す） */
export async function issueCorrectedInvoice(originalId: string, reason: string) {
  const original = await prisma.invoice.findUnique({
    where: { id: originalId },
    include: { lines: true },
  });
  if (!original) throw new Error("元の請求書が見つかりません");

  const settings = await getSettings();
  const invoiceNumber = await nextInvoiceNumber(settings.invoiceNumberPrefix);

  return prisma.invoice.create({
    data: {
      invoiceNumber,
      type: "corrected",
      customerId: original.customerId,
      issueDate: todayStr(),
      subtotalByTaxRate: original.subtotalByTaxRate,
      taxByTaxRate: original.taxByTaxRate,
      totalAmount: original.totalAmount,
      registrationNumber: settings.registrationNumber,
      issuerName: settings.issuerName,
      recipientName: original.recipientName,
      relatedInvoiceId: original.id,
      correctionReason: reason,
      status: "issued",
      lines: {
        create: original.lines.map((l) => ({
          reservationId: l.reservationId,
          transactionDate: l.transactionDate,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          taxRate: l.taxRate,
          isReducedTaxRate: l.isReducedTaxRate,
        })),
      },
    },
    include: { lines: true, customer: true },
  });
}

/**
 * 適格返還請求書を発行する（返金・値引き・キャンセル料の返還）。
 * 税込1万円未満は交付義務が免除されるため、その旨を呼び出し元に返す。
 */
export async function issueReturnedInvoice(
  originalId: string,
  returnedAmount: number,
  description: string
) {
  const original = await prisma.invoice.findUnique({ where: { id: originalId } });
  if (!original) throw new Error("元の請求書が見つかりません");

  const settings = await getSettings();
  const lines: TaxLine[] = [
    {
      description,
      transactionDate: todayStr(),
      quantity: 1,
      unitPrice: returnedAmount,
      taxRate: 10,
    },
  ];
  const breakdown = calculateTax(lines, settings.roundingMode);
  const invoiceNumber = await nextInvoiceNumber(settings.invoiceNumberPrefix);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      type: "returned",
      customerId: original.customerId,
      issueDate: todayStr(),
      subtotalByTaxRate: JSON.stringify(breakdown.subtotalByTaxRate),
      taxByTaxRate: JSON.stringify(breakdown.taxByTaxRate),
      totalAmount: breakdown.totalAmount,
      registrationNumber: settings.registrationNumber,
      issuerName: settings.issuerName,
      recipientName: original.recipientName,
      relatedInvoiceId: original.id,
      status: "issued",
      lines: {
        create: lines.map((l) => ({
          transactionDate: l.transactionDate,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.unitPrice,
          taxRate: l.taxRate,
        })),
      },
    },
    include: { lines: true, customer: true },
  });

  return { invoice, required: isReturnedInvoiceRequired(returnedAmount) };
}

export function parseBreakdown(json: string): Record<string, number> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
