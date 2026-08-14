import { prisma } from "./db";
import { getSettings } from "./settings";
import { parseBreakdown } from "./invoice";
import type { InvoiceDocumentProps } from "@/components/InvoiceDocument";

const ROUNDING_LABEL: Record<string, string> = {
  floor: "切捨て",
  ceil: "切上げ",
  round: "四捨五入",
};

/** 請求書のDBレコードを、書類コンポーネントに渡す形へ変換する */
export async function loadInvoiceDocument(invoiceId: string): Promise<InvoiceDocumentProps | null> {
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { orderBy: { transactionDate: "asc" } }, customer: true },
    }),
    getSettings(),
  ]);
  if (!invoice) return null;

  return {
    type: invoice.type,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    issuerName: invoice.issuerName,
    issuerAddress: settings.issuerAddress,
    registrationNumber: invoice.registrationNumber,
    recipientName: invoice.recipientName,
    totalAmount: invoice.totalAmount,
    subtotalByTaxRate: parseBreakdown(invoice.subtotalByTaxRate),
    taxByTaxRate: parseBreakdown(invoice.taxByTaxRate),
    lines: invoice.lines.map((l) => ({
      id: l.id,
      transactionDate: l.transactionDate,
      description: l.description,
      quantity: l.quantity,
      amount: l.amount,
      isReducedTaxRate: l.isReducedTaxRate,
    })),
    status: invoice.status,
    voidReason: invoice.voidReason,
    correctionReason: invoice.correctionReason,
    roundingLabel: ROUNDING_LABEL[settings.roundingMode] ?? settings.roundingMode,
  };
}
