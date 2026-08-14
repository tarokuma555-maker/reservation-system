import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 生きているかどうかだけを返す。
 *
 * デプロイ直後に「データベースまで繋がっているか」を確かめるために使う。
 * 誰でも開ける場所なので、件数や設置場所といった中身は返さない。
 * デモにあった診断用の受け口は、内部の情報が見えてしまうため本番前に外した。
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "connected" });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
