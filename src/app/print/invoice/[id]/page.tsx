import { notFound } from "next/navigation";
import InvoiceDocument from "@/components/InvoiceDocument";
import { loadInvoiceDocument } from "@/lib/invoice-view";

export const dynamic = "force-dynamic";

/** PDF化専用のページ。余計な枠を出さない。 */
export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await loadInvoiceDocument(id);
  if (!doc) notFound();
  return <InvoiceDocument {...doc} />;
}
