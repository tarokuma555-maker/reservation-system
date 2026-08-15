"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * LINEの中で開かれたときに、「どなたが開いているか」をこちらに伝える。
 *
 * 1. LINEの部品を読みこむ
 * 2. LINEから、その人を証明する引換券を受け取る
 * 3. サーバーに渡す（サーバーはLINEに問い合わせて本物か確かめる）
 * 4. 確認できたら画面を出し直す
 *
 * 引換券をそのまま画面の表示に使うことはしない。必ずサーバーで確かめる。
 */

type LiffSdk = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffSdk;
  }
}

const SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

function loadSdk(): Promise<LiffSdk> {
  if (window.liff) return Promise.resolve(window.liff);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const onReady = () => (window.liff ? resolve(window.liff) : reject(new Error("読み込めません")));

    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("読み込めません")));
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("読み込めません"));
    document.head.appendChild(script);
  });
}

export default function LiffBoot({ liffId }: { liffId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const liff = await loadSdk();
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("LINEからの証明を受け取れませんでした");

        const res = await fetch("/api/liff/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "確認できませんでした");
        }

        if (!cancelled) router.refresh();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liffId, router]);

  return (
    <div className="px-6 py-16 text-center">
      {error ? (
        <>
          <p className="text-sm font-bold text-ink">うまく開けませんでした</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            お手数ですが、一度この画面を閉じて、
            <br />
            LINEのメニューからもう一度お開きください。
          </p>
          <p className="mt-4 text-2xs text-slate-400">{error}</p>
        </>
      ) : (
        <>
          <span
            className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            aria-hidden
          />
          <p className="mt-3 text-xs text-slate-500">読み込んでいます…</p>
        </>
      )}
    </div>
  );
}
