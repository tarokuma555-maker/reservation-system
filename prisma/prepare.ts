/**
 * デプロイのたびに走る、データベースの下ごしらえ。
 *
 * やることは2つだけ。
 *  1. スキーマの変更をデータベースに反映する
 *  2. まだ何も入っていなければ、初期データを入れる
 *
 * 2は「空のときだけ」動く。すでにご予約が入っているデータベースを
 * 上書きしてしまわないようにするため、ここは何度走っても安全。
 */
import { execFileSync } from "node:child_process";

/**
 * スキーマ変更用の「直結」の接続先を決める。
 *
 * ふだんの読み書きは接続プール経由でよいが、スキーマの変更だけはプールを通せない。
 * Vercelでデータベースを繋ぐと、この直結用のURLが自動で入るのだが、
 * 名前がサービスによって違う（DATABASE_URL_UNPOOLED だったり POSTGRES_URL_NON_POOLING だったり）。
 * 手で設定していただくと間違いのもとなので、よくある名前を順に探す。
 */
function resolveDirectUrl(): string | undefined {
  const candidates = [
    "DIRECT_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL",
  ];
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL が未設定のため、データベースの準備はとばします。");
    console.log("（画面は動きますが、開いたときにデータベースに繋がらないと出ます）");
    return;
  }

  const directUrl = resolveDirectUrl();
  if (directUrl) process.env.DIRECT_URL = directUrl;

  console.log("スキーマを反映しています…");
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });

  const { ensureInitialData } = await import("../src/lib/demo-seed");
  const { seeded } = await ensureInitialData();
  console.log(seeded ? "初期データを入れました。" : "すでにデータがあるので、そのままにします。");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("データベースの準備に失敗しました:", e);
    process.exit(1);
  });
