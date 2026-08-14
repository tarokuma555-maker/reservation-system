import type { Metadata } from "next";
import "./globals.css";
import { ensureDemoReady } from "@/lib/bootstrap";

export const metadata: Metadata = {
  title: "LINE予約システム デモ",
  description: "家事代行・片付けコンサル向けのLINE予約システム（デモ）",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // デモのデータが古ければ、今日を基準に作り直す（Vercel上のみ）
  await ensureDemoReady().catch(() => null);

  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
