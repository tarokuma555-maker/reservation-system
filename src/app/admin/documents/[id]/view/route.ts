import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { verifyArchive } from "@/lib/document-archive";

export const dynamic = "force-dynamic";

/**
 * 保存してある控えを開く。
 *
 * 保存した当時から中身が変わっていないかを、開くたびに確かめる。
 * 変わっていた場合は、その旨を上に出したうえで中身も見せる
 * （見せないと、何が起きたのか確かめようがないため）。
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();

  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  if (!doc.content) {
    return NextResponse.json(
      { error: "この書類は中身が保存されていません（古い記録の可能性があります）" },
      { status: 404 }
    );
  }

  const intact = verifyArchive(doc.content, doc.fileHash);
  const warning = intact
    ? ""
    : `<p style="margin:0;padding:12px 16px;background:#FDEFEC;color:#9C3322;font-size:13px;
         font-family:system-ui,sans-serif;border-bottom:1px solid #F9DAD3">
         <b>この控えは、保存した当時と中身が一致しません。</b>
         取り扱いにご注意ください。</p>`;

  return new NextResponse(warning + doc.content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // 控えは外に出さない
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
