import { PrismaClient } from "@prisma/client";

/**
 * データベースへの接続。
 *
 * 本番は PostgreSQL。サーバーレスでは処理のたびに新しいインスタンスが立ち上がり、
 * そのたびに接続を張ると接続数がすぐ上限に達する。開発中はホットリロードのたびに
 * 増えていく。どちらも globalThis に1つだけ持つことで防いでいる。
 *
 * デモにあった「日付が変わったらデータを作り直す」仕掛けはここには無い。
 * 本番で同じことをすると、実際のご予約が毎日消えてしまうため。
 * 初期データの投入は `npm run db:seed` から明示的に実行する。
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
