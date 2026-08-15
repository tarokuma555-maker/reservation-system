import { prisma } from "@/lib/db";
import { getCurrentCustomer, isLiffLive } from "@/lib/session";
import { getLineCredentials } from "@/lib/line";
import LiffBoot from "@/components/LiffBoot";
import { switchCustomer } from "@/app/actions";
import LineRichMenu from "@/components/LineRichMenu";

export const dynamic = "force-dynamic";

export default async function LiffLayout({ children }: { children: React.ReactNode }) {
  const live = await isLiffLive();
  const [customers, current, credentials] = await Promise.all([
    // 本番では他のお客様の一覧を読み込まない（切替そのものが無いため）
    live ? Promise.resolve([]) : prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    getCurrentCustomer(),
    getLineCredentials(),
  ]);

  // 本番で「どなたか分からない」ときは、中身を一切出さずに確認から始める
  const needsIdentify = live && !current;

  return (
    <div className="min-h-screen bg-ground-warm">
      {/* つなぎこみ前の確認用の操作バー。本番のLINEには出ない */}
      {live ? null : (
      <div className="border-b border-slate-200/70 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-[420px] flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="text-2xs text-slate-400">確認用・操作中のお客様</span>
          <form action={switchCustomer} className="ml-auto flex items-center gap-1.5">
            <select
              name="customerId"
              defaultValue={current?.id}
              className="rounded-pill border border-slate-200 bg-surface px-3 py-1 text-2xs font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName ? c.companyName : c.name}
                  {c.address ? "" : "・オンラインのみ"}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-pill bg-brand-600 px-3 py-1 text-2xs font-bold text-white"
            >
              切替
            </button>
          </form>
        </div>
      </div>
      )}

      {/* 端末に見立てた枠 */}
      <div className="px-4 py-6">
        <div className="mx-auto flex min-h-[760px] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] bg-surface shadow-phone ring-1 ring-slate-200/70">
          <header className="flex items-center gap-3 bg-brand-sheen px-4 py-3.5 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8z" />
                <path d="M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">
                おそうじと片付けのくらしのて
              </p>
              <p className="text-2xs text-white/85">LINE公式アカウント</p>
            </div>
          </header>

          <div className="flex-1">
            {needsIdentify ? <LiffBoot liffId={credentials!.liffId!} /> : children}
          </div>

          {needsIdentify ? null : <LineRichMenu />}
        </div>
      </div>
    </div>
  );
}
