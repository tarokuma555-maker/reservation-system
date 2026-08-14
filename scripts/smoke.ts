/**
 * ブラウザで主要な導線を実際に操作して確認する簡易E2E。
 *
 *   npm run build && npx next start -p 3100
 *   npx tsx scripts/smoke.ts
 *
 * スクリーンショットは screenshots/ に出力される。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "screenshots";

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });

  const phone = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await phone.newPage();
  const steps: string[] = [];
  const shot = async (name: string) => {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    steps.push(name);
  };

  // --- お客様側 ---
  await page.goto(`${BASE}/liff`, { waitUntil: "networkidle" });
  await shot("01-liff-home");

  await page.goto(`${BASE}/liff/menus`, { waitUntil: "networkidle" });
  await shot("02-liff-menus");

  // オンラインで絞り込む
  await page.getByRole("link", { name: /オンライン/ }).first().click();
  await page.waitForLoadState("networkidle");
  await shot("03-liff-menus-online");

  // 訪問メニューを予約する
  await page.goto(`${BASE}/liff/menus?type=visit`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "選ぶ" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=時間を選ぶ");

  // 空き枠が出る日まで日付を送る（受付締切の関係で直近は埋まっている）
  let picked = false;
  const dateButtons = page.locator("button", { hasText: /月\d+日|今日|明日/ });
  const count = await dateButtons.count();
  for (let i = 0; i < count && !picked; i++) {
    await dateButtons.nth(i).click();
    await page.waitForTimeout(600);
    const slot = page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}$/ }).first();
    if (await slot.count()) {
      await slot.click();
      picked = true;
    }
  }
  if (!picked) throw new Error("空き枠が1つも見つかりませんでした");

  await shot("04-liff-booking");

  await page.getByRole("button", { name: "この内容で予約する" }).click();
  await page.waitForURL(/\/liff\/reservations\/.+/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await shot("05-liff-booked");

  const confirmed = await page.getByText("ご予約を承りました").count();
  if (!confirmed) throw new Error("予約完了の表示が出ていません");

  await page.goto(`${BASE}/liff/recurring`, { waitUntil: "networkidle" });
  await shot("06-liff-recurring");

  await page.goto(`${BASE}/liff/invoices`, { waitUntil: "networkidle" });
  await shot("07-liff-invoices");

  // --- 管理側 ---
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await desktop.newPage();
  const adminShot = async (name: string) => {
    await admin.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    steps.push(name);
  };

  await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await adminShot("08-admin-dashboard");

  await admin.goto(`${BASE}/admin/calendar`, { waitUntil: "networkidle" });
  await adminShot("09-admin-calendar");

  await admin.goto(`${BASE}/admin/recurring`, { waitUntil: "networkidle" });
  await admin.getByRole("link", { name: /様 —/ }).first().click();
  await admin.waitForLoadState("networkidle");
  await adminShot("10-admin-recurring-detail");

  await admin.goto(`${BASE}/admin/invoices`, { waitUntil: "networkidle" });
  await adminShot("11-admin-invoices");

  const pdfHref = await admin.getByRole("link", { name: "PDFを表示" }).first().getAttribute("href");
  if (!pdfHref) throw new Error("発行済み書類が見つかりませんでした");
  await admin.goto(`${BASE}${pdfHref}`, { waitUntil: "networkidle" });
  await adminShot("12-admin-invoice-pdf");

  await admin.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await adminShot("13-admin-settings");

  await browser.close();
  console.log(`✓ 全${steps.length}画面の確認が完了しました`);
  console.log(steps.map((s) => `  ${OUT}/${s}.png`).join("\n"));
}

main().catch((e) => {
  console.error("✗ 失敗:", e.message);
  process.exit(1);
});
