import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * SQLiteの置き場所。
 *
 * 手元では prisma/dev.db をそのまま使う。
 * サーバーレス（Vercel）ではアプリの配置場所が読み取り専用のため、
 * 起動時に書き込み可能な /tmp へコピーしてそちらを使う。
 * デモ用の割り切りで、本番はPostgreSQLを想定している。
 */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.VERCEL) return undefined; // 手元では schema.prisma の既定値を使う

  const writableDir = "/tmp/demo-db";
  const writablePath = path.join(writableDir, "dev.db");

  if (!existsSync(writablePath)) {
    mkdirSync(writableDir, { recursive: true });
    const bundled = path.join(process.cwd(), "prisma", "dev.db");
    if (existsSync(bundled)) copyFileSync(bundled, writablePath);
  }

  return `file:${writablePath}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
