import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * SQLiteの置き場所と、デモデータの用意。
 *
 * 手元では prisma/dev.db をそのまま使う。
 * サーバーレスでは配置場所が読み取り専用のため、起動時に /tmp へコピーして使う。
 * デモ用の割り切りで、本番はPostgreSQLを想定している。
 *
 * ここで「実行中かどうか」を AWS_LAMBDA_FUNCTION_NAME で判定しているのが要点。
 * VERCEL 環境変数はビルド中にも立っているため、それで判定すると
 * ビルド時のデータ投入まで /tmp に書いてしまい、成果物に含まれるDBが空になる。
 */
const isServerlessRuntime = Boolean(
  process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_REGION
);

function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!isServerlessRuntime) return undefined; // schema.prisma の既定値を使う

  const writableDir = "/tmp/demo-db";
  const writablePath = path.join(writableDir, "dev.db");

  if (!existsSync(writablePath)) {
    mkdirSync(writableDir, { recursive: true });
    const bundled = path.join(process.cwd(), "prisma", "dev.db");
    if (existsSync(bundled)) copyFileSync(bundled, writablePath);
  }

  return `file:${writablePath}`;
}

const url = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const base =
  globalForPrisma.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

/* ---------------- デモデータの鮮度を保つ ---------------- */

/**
 * サーバーレスでは実行のたびに新しいインスタンスが立ち上がる。
 * ビルド時に焼き込んだ日付のままだと「本日の予定」が空になるため、
 * 日付が変わっていたら今日を基準に作り直す。
 *
 * レイアウトで待つだけでは足りない（Next.jsはレイアウトとページを並行して描画するため、
 * 投入の途中でページが空のデータを読んでしまう）。
 * そこでDBアクセスそのものを入口で待たせる。
 */
let ready: Promise<void> | null = null;
let inBootstrap = false;

async function bootstrap(): Promise<void> {
  inBootstrap = true;
  try {
    const { ensureFreshDemoData } = await import("./demo-seed");
    await ensureFreshDemoData();
  } catch (e) {
    console.error("デモデータの準備に失敗しました", e);
  } finally {
    inBootstrap = false;
  }
}

function gate(): Promise<void> | null {
  if (!isServerlessRuntime) return null;
  if (inBootstrap) return null; // 投入処理自身は待たない（自己参照を避ける）
  if (!ready) ready = bootstrap();
  return ready;
}

/** モデル操作の前に、デモデータの準備完了を待たせる */
function withGate(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // $connect / $transaction などはそのまま通す
      if (typeof prop !== "string" || prop.startsWith("$") || prop.startsWith("_")) {
        return typeof value === "function" ? value.bind(target) : value;
      }
      if (!value || typeof value !== "object") return value;

      // prisma.customer などのモデルデリゲート
      return new Proxy(value as object, {
        get(model, method) {
          const fn = Reflect.get(model, method);
          if (typeof fn !== "function") return fn;
          return (...args: unknown[]) => {
            const pending = gate();
            if (!pending) return fn.apply(model, args);
            return pending.then(() => fn.apply(model, args));
          };
        },
      });
    },
  }) as PrismaClient;
}

export const prisma = isServerlessRuntime ? withGate(base) : base;
