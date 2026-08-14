import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateInvoicePdf, readPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 請求書PDFを生成して返す。生成済みならそのまま返す。 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const { filePath } = await generateInvoicePdf(id);
    const body = readPdf(filePath);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch {
    // Chromiumが使えない環境（サーバーレスなど）では、印刷用のページへ退避する。
    // ブラウザの印刷機能からそのままPDFにできる。
    return NextResponse.redirect(new URL(`/print/invoice/${id}?fallback=1`, _req.url));
  }
}
