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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL が未設定のため、データベースの準備はとばします。");
    console.log("（画面は動きますが、開いたときにデータベースに繋がらないと出ます）");
    return;
  }

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
