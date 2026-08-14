import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { Empty } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";
import { parseBreakdown } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "返金の書類",
  corrected: "書き直した書類",
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
        <h1 className="text-lg font-bold tracking-tight text-ink">領収書</h1>
        <p className="mt-1 text-xs text-slate-600">
          これまでの領収書は、いつでもここからご覧いただけます。なくされた場合も、再発行のご連絡は要りません。
        </p>
      </div>

      {invoices.length === 0 ? (
        <Empty>まだ領収書はありません</Empty>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const tax = parseBreakdown(inv.taxByTaxRate);
            const sub = parseBreakdown(inv.subtotalByTaxRate);
            return (
              <div key={inv.id} className="rounded-card border border-slate-200/80 bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {TYPE_LABEL[inv.type] ?? inv.type}
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

                <div className="mt-2 border-t border-slate-100 pt-2 text-2xs text-slate-500">
                  {Object.keys(tax).map((rate) => (
                    <p key={rate}>
                      {rate}%のぶん {formatYen(sub[rate] ?? 0)}（うち消費税 {formatYen(tax[rate] ?? 0)}）
                    </p>
                  ))}
                  <p className="mt-1">登録番号 {inv.registrationNumber}</p>
                  <p>番号 {inv.invoiceNumber}</p>
                </div>

                <Link
                  href={`/admin/invoices/${inv.id}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-pill border border-slate-200 bg-surface py-2.5 text-center text-xs font-bold text-brand-700 transition hover:border-brand-300"
                >
                  <Icon name="search" className="h-3.5 w-3.5" />
                  領収書を開く
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
