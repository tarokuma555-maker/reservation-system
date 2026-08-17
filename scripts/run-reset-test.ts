/**
 * デモのデータを消す操作の確かめを、専用のデータベースで走らせる。
 *
 * この確かめは全件削除を行うので、他の確かめと同じデータベースでは危ない
 * （node --test はファイルごとに並行で走るため、途中で足元を消しかねない）。
 * 使い捨てのデータベースを作り、そこに向けてから走らせる。
 *
 *   npm run test:reset
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TEST_DB = "reservation_reset_test";

/** .env を読む。Prisma Client は自分で読むが、このスクリプト自身も接続先が要る。 */
function loadEnvFile() {
  let text: string;
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function baseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL が未設定です。");
    process.exit(1);
  }
  return new URL(raw);
}

function psql(db: string, sql: string) {
  const url = baseUrl();
  url.pathname = `/${db}`;
  url.search = "";
  execFileSync("psql", [url.toString(), "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

function main() {
  loadEnvFile();
  const url = baseUrl();
  url.pathname = `/${TEST_DB}`;

  // 前回の残りごと作り直す。中身は毎回捨ててよい。
  psql("postgres", `DROP DATABASE IF EXISTS ${TEST_DB}`);
  psql("postgres", `CREATE DATABASE ${TEST_DB}`);

  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };

  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env });
  // 全件削除を伴う確かめなので、**1本ずつ**走らせる。
  // 同時に走らせると、片方の削除がもう片方の足元をすくう。
  execFileSync(
    "node",
    [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      "tests/reset.dbtest.ts",
      "tests/owner-booking.dbtest.ts",
    ],
    { stdio: "inherit", env }
  );

  psql("postgres", `DROP DATABASE IF EXISTS ${TEST_DB}`);
}

main();
