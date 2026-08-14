import { notFound } from "next/navigation";
import InvoiceDocument from "@/components/InvoiceDocument";
import { loadInvoiceDocument } from "@/lib/invoice-view";

export const dynamic = "force-dynamic";

/** PDF化専用のページ。余計な枠を出さない。 */
export default async function PrintInvoice({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fallback?: string }>;
}) {
  const { id } = await params;
  const { fallback } = await searchParams;
  const doc = await loadInvoiceDocument(id);
  if (!doc) notFound();

  return (
    <>
      {fallback ? (
        <p className="no-print border-b border-warn-100 bg-warn-50 px-6 py-3 text-xs leading-relaxed text-warn-700">
          この環境ではPDFファイルの自動生成が使えないため、印刷用の表示に切り替えました。
          ブラウザの印刷（⌘P / Ctrl+P）から「PDFとして保存」を選ぶと、同じ見た目のPDFになります。
        </p>
      ) : null}
      <InvoiceDocument {...doc} />
    </>
  );
}
