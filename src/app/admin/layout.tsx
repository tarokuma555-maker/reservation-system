import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { lineMode } from "@/lib/line";
import { googleMode } from "@/lib/google-calendar";
import { Icon, type IconName } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * ナビゲーションの言葉は「その画面で何をするか」で書く。
 * 「請求書・領収書」のような書類名ではなく「領収書を出す」のように動作で並べると、
 * どこを押せばいいかが読むだけで分かる。
 */
const NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    group: "毎日つかう",
    items: [
      { href: "/admin", label: "ホーム", icon: "home" },
      { href: "/admin/calendar", label: "予定表", icon: "calendar" },
      { href: "/admin/recurring", label: "定期のお客様", icon: "repeat" },
      { href: "/admin/customers", label: "お客様", icon: "users" },
      { href: "/admin/menus", label: "メニューと料金", icon: "list" },
    ],
  },
  {
    group: "お金まわり",
    items: [
      { href: "/admin/invoices", label: "領収書を出す", icon: "receipt" },
      { href: "/admin/expenses", label: "経費を入れる", icon: "camera" },
      { href: "/admin/documents", label: "レシートの保管", icon: "folder" },
      { href: "/admin/accounting", label: "売上と経費のまとめ", icon: "chart" },
    ],
  },
  {
    group: "設定",
    items: [
      { href: "/admin/settings", label: "お店の設定", icon: "settings" },
      { href: "/admin/messages", label: "LINEの設定", icon: "chat" },
      { href: "/admin/calendar-sync", label: "カレンダー連携", icon: "link" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const line = await lineMode();
  const google = await googleMode();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print shrink-0 border-b border-slate-200/80 bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="px-5 pb-3 pt-5">
          <p className="text-sm font-bold leading-snug tracking-tight text-ink">
            {settings.issuerName}
          </p>
          <p className="text-2xs text-slate-500">管理画面</p>
        </div>

        <nav className="flex gap-6 overflow-x-auto px-3 pb-4 lg:flex-col lg:gap-5 lg:overflow-visible">
          {NAV.map((group) => (
            <div key={group.group} className="shrink-0">
              <p className="mb-1.5 hidden px-3 text-2xs font-bold tracking-wide text-slate-400 lg:block">
                {group.group}
              </p>
              <div className="flex gap-1 lg:flex-col">
                {group.items.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Icon name={n.icon} className="h-4 w-4 text-slate-400" />
                    {n.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200/80 px-5 py-4 lg:block">
          <p className="text-2xs font-bold tracking-wide text-slate-400">つながっているもの</p>
          <ul className="mt-2 space-y-1.5">
            <ModeRow label="LINE" mode={line} />
            <ModeRow label="カレンダー" mode={google} />
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            「お試し」は、実際には送らずに動きだけ確認できる状態です。
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function ModeRow({ label, mode }: { label: string; mode: "live" | "mock" }) {
  const live = mode === "live";
  return (
    <li className="flex items-center gap-2 text-2xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-good-600" : "bg-brand-400"}`}
        aria-hidden
      />
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-bold text-slate-500">
        {live ? "つながっています" : "お試し"}
      </span>
    </li>
  );
}
