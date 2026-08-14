"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * LINEのリッチメニューを、実機と同じ 3列×2行 で再現する。
 * トークバーをタップすると開閉するところまで実機に合わせている。
 */
const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/liff", label: "ホーム", icon: "home" },
  { href: "/liff/menus", label: "予約する", icon: "calendar" },
  { href: "/liff/reservations", label: "予約の確認", icon: "calendarCheck" },
  { href: "/liff/recurring", label: "定期でのご利用", icon: "repeat" },
  { href: "/liff/talk", label: "トーク", icon: "chat" },
  { href: "/liff/invoices", label: "領収書", icon: "receipt" },
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1.5 px-1 py-4 transition ${
                  active ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5 text-white" />
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
        className="flex w-full items-center justify-center gap-1.5 border-t border-brand-700/25 bg-brand-700 py-2.5 text-xs font-bold text-white"
        aria-expanded={open}
      >
        <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform ${open ? "" : "rotate-180"}`} />
        メニュー
      </button>
    </div>
  );
}
