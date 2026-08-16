"use client";

import { useEffect } from "react";

/**
 * 開いたら、そのまま印刷の画面を出す。
 *
 * 「PDFで保存」を押した先で、もう一度メニューを探させないため。
 * 中身が描き終わってから呼ぶ（早すぎると白紙で印刷される）。
 */
export default function PrintTrigger() {
  useEffect(() => {
    let cancelled = false;

    // 画像やフォントの読み込みを待ってから
    const start = () => {
      if (cancelled) return;
      // 描画が落ち着くのを1フレーム待つ
      requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  return null;
}
