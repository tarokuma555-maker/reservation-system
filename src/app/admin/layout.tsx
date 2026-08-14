import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { lineMode } from "@/lib/line";
import { googleMode } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "予約",
    items: [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/calendar", label: "スケジュール" },
      { href: "/admin/recurring", label: "定期予約" },
      { href: "/admin/customers", label: "顧客" },
      { href: "/admin/menus", label: "メニュー" },
    ],
  },
  {
    group: "会計",
    items: [
      { href: "/admin/invoices", label: "請求書・領収書" },
      { href: "/admin/expenses", label: "経費・レシート" },
      { href: "/admin/documents", label: "証憑ボックス" },
      { href: "/admin/accounting", label: "帳簿・決算書" },
    ],
  },
  {
    group: "連携と設定",
    items: [
      { href: "/admin/messages", label: "LINE連携" },
      { href: "/admin/calendar-sync", label: "Googleカレンダー" },
      { href: "/admin/settings", label: "設定" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const line = lineMode();
  const google = googleMode();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print shrink-0 border-b border-slate-200/80 bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="px-5 pb-3 pt-5">
          <Link
            href="/"
            className="text-2xs font-bold text-slate-400 transition hover:text-brand-600"
          >
            ← デモTOP
          </Link>
          <p className="mt-2 text-sm font-bold leading-snug tracking-tight text-ink">
            {settings.issuerName}
          </p>
          <p className="text-2xs text-slate-500">管理画面</p>
        </div>

        <nav className="flex gap-6 overflow-x-auto px-3 pb-4 lg:flex-col lg:gap-4 lg:overflow-visible">
          {NAV.map((group) => (
            <div key={group.group} className="shrink-0">
              <p className="mb-1 hidden px-3.5 text-2xs font-bold tracking-wide text-slate-400 lg:block">
                {group.group}
              </p>
              <div className="flex gap-1 lg:flex-col">
                {group.items.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="whitespace-nowrap rounded-pill px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200/80 px-5 py-4 lg:block">
          <p className="text-2xs font-bold tracking-wide text-slate-400">外部連携</p>
          <ul className="mt-2 space-y-1.5">
            <ModeRow label="LINE" mode={line} />
            <ModeRow label="Googleカレンダー" mode={google} />
          </ul>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function ModeRow({ label, mode }: { label: string; mode: "live" | "mock" }) {
  return (
    <li className="flex items-center gap-2 text-2xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${mode === "live" ? "bg-good-600" : "bg-brand-400"}`}
        aria-hidden
      />
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-bold text-slate-500">
        {mode === "live" ? "接続中" : "モック"}
      </span>
    </li>
  );
}
