import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINE予約システム デモ",
  description: "家事代行・片付けコンサル向けのLINE予約システム（デモ）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
