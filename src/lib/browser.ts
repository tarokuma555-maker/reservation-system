import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Chromium の実行ファイルを探す。
 * Playwright が期待するバージョンと、実際に入っているバージョンがずれている環境でも
 * 動くように、実在するものを拾う。
 */
export function resolveChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  const candidates: string[] = [];
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith("chromium")) continue;
    for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const p = path.join(root, dir, sub);
      if (existsSync(p)) candidates.push(p);
    }
  }

  // headless_shell よりフル版の chrome を優先する
  candidates.sort((a, b) => (a.endsWith("chrome") ? -1 : 1) - (b.endsWith("chrome") ? -1 : 1));
  return candidates[0];
}
