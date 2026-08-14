import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** デプロイ環境の切り分け用。原因が分かったら削除する。 */
export async function GET() {
  const bundled = path.join(process.cwd(), "prisma", "dev.db");
  const tmp = "/tmp/demo-db/dev.db";

  const info: Record<string, unknown> = {
    cwd: process.cwd(),
    vercel: process.env.VERCEL ?? null,
    bundledExists: existsSync(bundled),
    bundledSize: existsSync(bundled) ? statSync(bundled).size : null,
    tmpExists: existsSync(tmp),
    tmpSize: existsSync(tmp) ? statSync(tmp).size : null,
  };

  try {
    info.counts = {
      settings: await prisma.setting.count(),
      customers: await prisma.customer.count(),
      menus: await prisma.menu.count(),
      reservations: await prisma.reservation.count(),
      journalEntries: await prisma.journalEntry.count(),
    };
    const marker = await prisma.setting.findUnique({ where: { key: "demo_seeded_on" } });
    info.marker = marker?.value ?? null;
  } catch (e) {
    info.queryError = e instanceof Error ? e.message.slice(0, 400) : String(e);
  }

  return NextResponse.json(info);
}
