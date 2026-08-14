import Link from "next/link";
import { notFound } from "next/navigation";
import InvoiceDocument from "@/components/InvoiceDocument";
import { loadInvoiceDocument } from "@/lib/invoice-view";
import { prisma } from "@/lib/db";
import { sendInvoiceByLineAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, invoice] = await Promise.all([
    loadInvoiceDocument(id),
    prisma.invoice.findUnique({ where: { id }, include: { customer: true } }),
  ]);
  if (!doc || !invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/invoices" className="text-sm text-slate-500 hover:underline">
          ← 一覧へ戻る
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/invoices/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            PDFをダウンロード
          </a>
          <form action={sendInvoiceByLineAction}>
            <input type="hidden" name="invoiceId" value={id} />
            <button className="rounded-lg bg-sage-600 px-3 py-1.5 text-sm font-medium text-white">
              LINEで送る
            </button>
          </form>
        </div>
      </div>

      {invoice.sentAt ? (
        <p className="no-print rounded-lg border border-sage-300 bg-sage-50 px-3 py-2 text-xs text-sage-700">
          {invoice.customer.name} 様へ送付済み（
          {invoice.sentAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ {invoice.sentVia}）
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-300 shadow-sm">
        <InvoiceDocument {...doc} />
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
        <p className="mt-2">
          「PDFをダウンロード」を押すと、この見た目のままA4のPDFが生成されます（ヘッドレスChromiumで印刷）。
          生成したPDFは証憑として保存され、取引年月日・金額・取引先で検索できます。
        </p>
      </div>
    </div>
  );
}
