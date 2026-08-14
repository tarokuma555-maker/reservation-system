import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { Empty } from "@/components/ui";
import { formatYen } from "@/lib/time";
import { parseBreakdown } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "適格返還請求書",
  corrected: "修正インボイス",
};

export default async function CustomerInvoicesPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;

  const invoices = await prisma.invoice.findMany({
    where: { customerId: customer.id },
    orderBy: { issueDate: "desc" },
    include: { lines: true },
  });

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-ink">領収書・請求書</h1>
        <p className="mt-1 text-xs text-slate-600">
          発行した書類はこちらからいつでもご確認いただけます。紛失時の再発行のご連絡は不要です。
        </p>
      </div>

      {invoices.length === 0 ? (
        <Empty>発行済みの書類はまだありません</Empty>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const tax = parseBreakdown(inv.taxByTaxRate);
            const sub = parseBreakdown(inv.subtotalByTaxRate);
            return (
              <div key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {TYPE_LABEL[inv.type] ?? inv.type} ・ {inv.invoiceNumber}
                    </p>
                    <p className="mt-0.5 font-bold text-ink">{formatYen(inv.totalAmount)}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{inv.issueDate}</p>
                </div>

                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {inv.lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="truncate">{l.description}</span>
                      <span className="shrink-0">{formatYen(l.amount)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  {Object.keys(tax).map((rate) => (
                    <p key={rate}>
                      {rate}%対象 {formatYen(sub[rate] ?? 0)} ／ 消費税 {formatYen(tax[rate] ?? 0)}
                    </p>
                  ))}
                  <p className="mt-1">登録番号 {inv.registrationNumber}</p>
                </div>

                <Link
                  href={`/admin/invoices/${inv.id}`}
                  className="mt-3 block rounded-lg border border-slate-300 py-2 text-center text-xs text-slate-700"
                >
                  PDFを表示する
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
