"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * 「この文字列をあちらの画面に貼ってください」という場面のための部品。
 *
 * 手で打ち写すと必ずどこかで打ちまちがえるので、押すだけで写せるようにしている。
 * 実際に写せたことが分かるよう、押したあと少しのあいだ表示を変える。
 */
export default function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // 古いブラウザ向けの逃げ道
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-2xs font-bold tracking-wide text-slate-600">{label}</p>
      ) : null}
      <div className="flex items-stretch gap-2">
        <code className="scroll-x min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-700">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 text-xs font-bold transition ${
            copied
              ? "bg-good-600 text-white"
              : "border border-slate-200 bg-surface text-slate-700 hover:border-brand-300 hover:text-brand-700"
          }`}
        >
          <Icon name={copied ? "check" : "list"} className="h-3.5 w-3.5" />
          {copied ? "写しました" : "写す"}
        </button>
      </div>
    </div>
  );
}
