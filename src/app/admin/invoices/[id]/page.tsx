import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseBreakdown } from "@/lib/invoice";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "適格返還請求書",
  corrected: "修正インボイス",
};

/** 交付する書類の見た目。本実装ではこのレイアウトをそのままPDF化する。 */
export default async function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { transactionDate: "asc" } }, customer: true },
    }),
    getSettings(),
  ]);
  if (!invoice) notFound();

  const sub = parseBreakdown(invoice.subtotalByTaxRate);
  const tax = parseBreakdown(invoice.taxByTaxRate);
  const rates = Object.keys(tax).sort();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/invoices" className="text-sm text-slate-500 hover:underline">
          ← 一覧へ戻る
        </Link>
        <p className="text-xs text-slate-500">
          本実装ではこのレイアウトをPDF化し、LINEに自動送付します
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wide text-ink">
              {TYPE_LABEL[invoice.type] ?? invoice.type}
            </h1>
            {invoice.status === "void" ? (
              <p className="mt-1 text-sm font-bold text-rose-600">※ この書類は無効です</p>
            ) : null}
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>No. {invoice.invoiceNumber}</p>
            <p>発行日 {invoice.issueDate}</p>
          </div>
        </div>

        {/* ⑥ 宛名 */}
        <p className="mt-6 border-b border-slate-400 pb-1 text-lg">{invoice.recipientName}</p>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs text-slate-500">合計金額（税込）</p>
            <p className="text-3xl font-bold tabular-nums text-ink">
              {formatYen(invoice.totalAmount)}
            </p>
          </div>

          {/* ① 発行事業者の名称および登録番号 */}
          <div className="text-right text-xs leading-relaxed text-slate-700">
            <p className="text-sm font-bold text-ink">{invoice.issuerName}</p>
            <p>{settings.issuerAddress}</p>
            <p className="mt-1 font-medium">登録番号 {invoice.registrationNumber}</p>
          </div>
        </div>

        {/* ②③ 取引年月日と取引内容 */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-y border-slate-300 text-xs text-slate-600">
              <th className="py-2 text-left">取引年月日</th>
              <th className="py-2 text-left">内容</th>
              <th className="py-2 text-right">数量</th>
              <th className="py-2 text-right">金額（税込）</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-2 tabular-nums text-slate-600">{l.transactionDate}</td>
                <td className="py-2">
                  {l.description}
                  {l.isReducedTaxRate ? <span className="ml-1 text-xs">※軽減税率対象</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatYen(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ④⑤ 税率ごとに区分した対価の額と消費税額 */}
        <div className="mt-4 flex justify-end">
          <table className="w-full max-w-xs text-sm">
            <tbody>
              {rates.map((rate) => (
                <tr key={rate}>
                  <td className="py-1 text-slate-600">{rate}％対象（税抜）</td>
                  <td className="py-1 text-right tabular-nums">{formatYen(sub[rate] ?? 0)}</td>
                </tr>
              ))}
              {rates.map((rate) => (
                <tr key={`t-${rate}`}>
                  <td className="py-1 text-slate-600">消費税（{rate}％）</td>
                  <td className="py-1 text-right tabular-nums">{formatYen(tax[rate] ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-300">
                <td className="py-2 font-bold">合計（税込）</td>
                <td className="py-2 text-right font-bold tabular-nums">
                  {formatYen(invoice.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {invoice.correctionReason ? (
          <p className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
            修正理由: {invoice.correctionReason}
          </p>
        ) : null}
        {invoice.voidReason ? (
          <p className="mt-4 rounded bg-rose-50 p-3 text-xs text-rose-600">
            無効理由: {invoice.voidReason}
          </p>
        ) : null}

        <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
          この書類は適格請求書等保存方式（インボイス制度）の記載事項を満たしています。
          消費税額は税率ごとに1回のみ端数処理（{settings.roundingMode === "floor" ? "切捨て" : settings.roundingMode === "ceil" ? "切上げ" : "四捨五入"}）しています。
        </p>
      </div>

      <div className="no-print rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
        <p className="font-bold text-slate-700">法定6項目の対応箇所</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>発行事業者の名称および登録番号 → 右上の事業者欄</li>
          <li>取引年月日 → 明細の左列</li>
          <li>取引内容 → 明細の内容列（軽減税率対象はその旨を表示）</li>
          <li>税率ごとに区分した対価の額 → 右下の内訳</li>
          <li>税率ごとの消費税額 → 右下の内訳</li>
          <li>交付を受ける事業者の名称 → 宛名</li>
        </ol>
      </div>
    </div>
  );
}
