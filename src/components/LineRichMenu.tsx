"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * LINEのリッチメニューを、実機と同じ 3列×2行 で再現する。
 * トークバーをタップすると開閉するところまで実機に合わせている。
 */
const ITEMS = [
  { href: "/liff", label: "ホーム", icon: HomeIcon },
  { href: "/liff/menus", label: "予約する", icon: CalendarIcon },
  { href: "/liff/reservations", label: "予約の確認", icon: CheckIcon },
  { href: "/liff/recurring", label: "定期利用", icon: RepeatIcon },
  { href: "/liff/talk", label: "トーク", icon: ChatIcon },
  { href: "/liff/invoices", label: "領収書", icon: ReceiptIcon },
];

export default function LineRichMenu() {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <div className="sticky bottom-0 z-30 mt-auto">
      {open ? (
        <div className="grid grid-cols-3 gap-px bg-brand-700/20 bg-brand-sheen">
          {ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1.5 px-1 py-4 transition ${
                  active ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5 text-white" />
                <span className="text-[11px] font-bold tracking-tight text-white">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 border-t border-brand-700/25 bg-brand-700 py-2.5 text-xs font-bold text-white"
        aria-expanded={open}
      >
        <span
          className={`inline-block transition-transform ${open ? "" : "rotate-180"}`}
          aria-hidden
        >
          ▾
        </span>
        メニュー
      </button>
    </div>
  );
}

/* ---- アイコン（外部読み込みなしで済ませる） ---- */

type IconProps = { className?: string };

function base(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.75 20v-5.5h4.5V20" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 14h3" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20.5 6.5 9.5 17.5 4 12" />
    </svg>
  );
}

function RepeatIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8.5A4.5 4.5 0 0 1 8.5 4H18" />
      <path d="m15 1.5 3 2.5-3 2.5" />
      <path d="M20 15.5a4.5 4.5 0 0 1-4.5 4.5H6" />
      <path d="m9 22.5-3-2.5 3-2.5" />
    </svg>
  );
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 5.5h16v11H12l-5 4v-4H4z" />
    </svg>
  );
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 2.5h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </svg>
  );
}
