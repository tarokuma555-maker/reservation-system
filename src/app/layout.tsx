import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { isDemoMode } from "@/lib/demo-mode";

/** タブに出る名前は、お店の名前をそのまま使う（設定を変えれば一緒に変わる） */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const base = settings?.issuerName ?? "予約システム";
  // デモ側は、タブだけ見ても本番と取り違えないようにする
  const name = isDemoMode() ? `${base}（デモ）` : base;
  return {
    title: { default: name, template: `%s｜${name}` },
    description: isDemoMode() ? `${base}の予約システムのデモ` : `${base}のご予約ページ`,
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
