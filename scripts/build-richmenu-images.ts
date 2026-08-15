/**
 * LINEの下に出るメニューの背景画像を作る。
 *
 * LINEは画像のないメニューを受け付けないため、これが無いと公開できない。
 * ふつうはデザイナーに頼むところだが、アプリと同じアイコン・同じ色で
 * その場で作ってしまう。
 *
 * 生成は「ここ」で行い、できた画像を同梱する。本番のサーバーには
 * 日本語のフォントもブラウザも無く、その場では作れないため。
 *
 *   npx tsx scripts/build-richmenu-images.ts
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { resolveChromiumPath } from "../src/lib/browser";

const WIDTH = 2500;
const HEIGHT = 1686;
const OUT_DIR = path.join(process.cwd(), "public", "richmenu");

/** アプリで使っているのと同じ線画アイコン */
const ICONS: Record<string, string> = {
  sparkle:
    '<path d="M11 3.5 12.6 8l4.4 1.6L12.6 11.2 11 15.6 9.4 11.2 5 9.6 9.4 8z"/><path d="M17.75 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  list: '<path d="M8.5 6.75h11M8.5 12h11M8.5 17.25h11"/><path d="M4.5 6.75h.01M4.5 12h.01M4.5 17.25h.01"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.75h17M8 3v4M16 3v4"/>',
  calendarCheck:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.75h17M8 3v4M16 3v4"/><path d="m8.75 14.75 2.25 2.25 4.25-4.25"/>',
  repeat:
    '<path d="M4 9.25A4.75 4.75 0 0 1 8.75 4.5H18"/><path d="m15.25 1.75 3 2.75-3 2.75"/><path d="M20 14.75A4.75 4.75 0 0 1 15.25 19.5H6"/><path d="m8.75 22.25-3-2.75 3-2.75"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.75 9.5a2.25 2.25 0 1 1 3 2.12V13.5"/><path d="M12 16.75h.01"/>',
  chat: '<path d="M4.5 5.5h15v11h-8.25L7 20.25V16.5H4.5z"/>',
  edit: '<path d="M4.5 19.5h4l10-10a2.12 2.12 0 0 0-3-3l-10 10z"/><path d="m14.5 6.5 3 3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  receipt:
    '<path d="M6.25 2.75h11.5v18.5l-2.3-1.6-2.3 1.6-2.3-1.6-2.3 1.6-2.3-1.6z"/><path d="M9.5 8h5M9.5 12h5"/>',
};

type Area = { label: string; icon: string };

const MENUS: { file: string; areas: Area[] }[] = [
  {
    file: "default.png",
    areas: [
      { label: "はじめての方へ", icon: "sparkle" },
      { label: "料金・メニュー", icon: "list" },
      { label: "予約する", icon: "calendar" },
      { label: "定期利用", icon: "repeat" },
      { label: "よくある質問", icon: "help" },
      { label: "お問い合わせ", icon: "chat" },
    ],
  },
  {
    file: "booked.png",
    areas: [
      { label: "次回の予約", icon: "calendarCheck" },
      { label: "予約を変更", icon: "edit" },
      { label: "キャンセル", icon: "close" },
      { label: "定期利用の管理", icon: "repeat" },
      { label: "新しく予約", icon: "calendar" },
      { label: "領収書", icon: "receipt" },
    ],
  },
];

function cell(area: Area): string {
  return `
    <div class="cell">
      <svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        ${ICONS[area.icon] ?? ""}
      </svg>
      <span class="label">${area.label}</span>
    </div>`;
}

function html(areas: Area[]): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    font-family: "IPAGothic", "Noto Sans JP", sans-serif;
    background: #FFF8F2;
    display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
    gap: 4px; padding: 4px;
  }
  .cell {
    background: #FFFFFF;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 44px;
    color: #D2500F;
    border-radius: 12px;
  }
  /* 押せる場所が分かるよう、境目をうっすら出す */
  .cell:nth-child(-n+3) { border-bottom: 2px solid #F6E7DA; }
  .icon { width: 190px; height: 190px; }
  .label {
    font-size: 62px; font-weight: bold; color: #2B1A10;
    letter-spacing: 0.02em;
  }
</style></head>
<body>${areas.map(cell).join("")}</body></html>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath: resolveChromiumPath() });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  for (const menu of MENUS) {
    await page.setContent(html(menu.areas), { waitUntil: "load" });
    const file = path.join(OUT_DIR, menu.file);
    await page.screenshot({ path: file, type: "png" });
    console.log(`作成: public/richmenu/${menu.file}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error("メニュー画像の作成に失敗しました:", e);
  process.exit(1);
});
