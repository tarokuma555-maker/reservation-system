import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { switchCustomer } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LiffLayout({ children }: { children: React.ReactNode }) {
  const [customers, current] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    getCurrentCustomer(),
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* デモ用の操作バー（本番のLINEには存在しない） */}
      <div className="border-b border-slate-300 bg-slate-800 px-4 py-2 text-white">
        <div className="mx-auto flex max-w-md flex-wrap items-center gap-2 text-xs">
          <Link href="/" className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
            ← デモTOP
          </Link>
          <span className="opacity-70">操作中のお客様:</span>
          <form action={switchCustomer} className="flex items-center gap-1">
            <select
              name="customerId"
              defaultValue={current?.id}
              className="rounded bg-white/10 px-2 py-1 text-white"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id} className="text-slate-900">
                  {c.companyName ? `${c.companyName}（${c.name}）` : c.name}
                  {c.address ? "" : "・オンラインのみ"}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-sage-500 px-2 py-1 font-medium">
              切替
            </button>
          </form>
        </div>
      </div>

      {/* LINEのトーク画面に見立てた枠 */}
      <div className="mx-auto max-w-md bg-white pb-24 shadow-xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#7fa899] px-4 py-3 text-white">
          <p className="text-sm font-bold">おそうじと片付けのくらしのて</p>
          <p className="text-[11px] opacity-90">LINE公式アカウント</p>
        </header>
        {children}
      </div>

      <RichMenu />
    </div>
  );
}

/** リッチメニュー（画面下部に固定表示される） */
function RichMenu() {
  const items = [
    { href: "/liff", label: "ホーム", icon: "🏠" },
    { href: "/liff/menus", label: "予約する", icon: "📅" },
    { href: "/liff/reservations", label: "予約確認", icon: "✅" },
    { href: "/liff/recurring", label: "定期利用", icon: "🔁" },
    { href: "/liff/talk", label: "トーク", icon: "💬" },
    { href: "/liff/invoices", label: "領収書", icon: "🧾" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-white">
      <div className="mx-auto grid max-w-md grid-cols-6">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] text-slate-600 hover:bg-sage-50"
          >
            <span className="text-lg leading-none">{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
