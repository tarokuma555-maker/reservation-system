import { ensureFreshDemoData } from "./demo-seed";

/**
 * デモデータの鮮度を保つ。
 *
 * サーバーレスでは実行のたびに新しいインスタンスが立ち上がるため、
 * ビルド時に焼き込んだ日付のままだと「本日の予定」が空になってしまう。
 * 起動後の最初のアクセスで、今日を基準にしたデータへ入れ替える。
 *
 * 同時アクセスで二重に走らないよう、Promise を使い回す。
 */
let inflight: Promise<unknown> | null = null;

export function ensureDemoReady() {
  if (!process.env.VERCEL) return Promise.resolve();
  if (!inflight) {
    inflight = ensureFreshDemoData().catch((e) => {
      inflight = null; // 失敗したら次のアクセスでやり直す
      throw e;
    });
  }
  return inflight;
}
