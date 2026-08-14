import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "ダッシュボード", icon: "📊" },
  { href: "/admin/calendar", label: "スケジュール", icon: "🗓️" },
  { href: "/admin/recurring", label: "定期予約", icon: "🔁" },
  { href: "/admin/customers", label: "顧客", icon: "👤" },
  { href: "/admin/menus", label: "メニュー", icon: "🧹" },
  { href: "/admin/invoices", label: "請求書・領収書", icon: "🧾" },
  { href: "/admin/settings", label: "設定", icon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print border-b border-slate-200 bg-white lg:min-h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="p-4">
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← デモTOP
          </Link>
          <p className="mt-2 text-sm font-bold text-ink">{settings.issuerName}</p>
          <p className="text-[11px] text-slate-500">管理画面</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-sage-50"
            >
              <span>{n.icon}</span>
              <span className="whitespace-nowrap">{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
