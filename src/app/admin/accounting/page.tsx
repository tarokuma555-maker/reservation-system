import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureChartOfAccounts, ensureFiscalYear, trialBalance } from "@/lib/accounting";
import { Card, Empty, SectionTitle } from "@/components/ui";
import { formatYen } from "@/lib/time";
import { runDepreciationAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  asset: "資産",
  liability: "負債",
  equity: "純資産",
  revenue: "収益",
  expense: "費用",
};

const SOURCE_LABEL: Record<string, string> = {
  invoice: "売上（請求書）",
  payment: "入金",
  expense: "経費",
  depreciation: "減価償却",
  manual: "手入力",
  adjustment: "決算整理",
};

export default async function AccountingPage() {
  await ensureChartOfAccounts();
  const fy = await ensureFiscalYear();

  const [tb, entries, assets] = await Promise.all([
    trialBalance(fy.id),
    prisma.journalEntry.findMany({
      where: { fiscalYearId: fy.id },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: { lines: { include: { account: true } } },
      take: 30,
    }),
    prisma.fixedAsset.findMany({ include: { account: true } }),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink">帳簿</h1>
          <p className="text-sm text-slate-500">
            {fy.startDate} 〜 {fy.endDate}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/admin/accounting/statements"
            className="rounded-pill bg-brand-600 px-4 py-2.5 font-bold text-white shadow-card transition hover:bg-brand-700"
          >
            決算書を見る
          </Link>
          <Link
            href="/admin/accounting/tax"
            className="rounded-lg border border-slate-300 bg-surface px-4 py-2"
          >
            消費税の集計
          </Link>
        </div>
      </header>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          tb.balanced
            ? "border-good-100 bg-good-50 text-good-700"
            : "border-bad-100 bg-bad-50 text-bad-700"
        }`}
      >
        <p className="font-bold">
          {tb.balanced
            ? `貸借が一致しています（借方・貸方ともに ${formatYen(tb.totalDebit)}）`
            : `貸借が一致していません（借方 ${formatYen(tb.totalDebit)} / 貸方 ${formatYen(tb.totalCredit)}）`}
        </p>
        <p className="mt-1 text-xs">
          仕訳は保存前に貸借の一致を検証しているため、ここが合わない状態にはなりません。
        </p>
      </div>

      <section>
        <SectionTitle hint="月次で数字を見られることが、経営上いちばん効きます">残高試算表</SectionTitle>
        {tb.rows.length === 0 ? (
          <Empty>まだ仕訳がありません。予約を実施済みにするか、経費を登録してください。</Empty>
        ) : (
          <Card className="scroll-x p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 text-left">科目</th>
                  <th className="px-4 py-2.5 text-left">区分</th>
                  <th className="px-4 py-2.5 text-right">借方</th>
                  <th className="px-4 py-2.5 text-right">貸方</th>
                  <th className="px-4 py-2.5 text-right">残高</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tb.rows.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-2">
                      <span className="text-slate-400">{r.code}</span> {r.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{TYPE_LABEL[r.type]}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.debit ? formatYen(r.debit) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.credit ? formatYen(r.credit) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatYen(Math.abs(r.balance))}
                      <span className="ml-1 text-2xs text-slate-400">
                        {r.balance >= 0 ? "借" : "貸"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-300 bg-brand-50/60 text-sm font-bold">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>
                    合計
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(tb.totalDebit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(tb.totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle hint="決算のときだけ必要な仕訳です">決算整理</SectionTitle>
        <Card>
          <div className="mb-3">
            <p className="text-sm font-medium text-ink">固定資産台帳</p>
            {assets.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">登録されている固定資産はありません</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 text-left">資産</th>
                    <th className="py-1 text-right">取得価額</th>
                    <th className="py-1 text-right">耐用年数</th>
                    <th className="py-1 text-right">償却累計</th>
                    <th className="py-1 text-right">帳簿価額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1.5">
                        {a.name}
                        <span className="ml-2 text-xs text-slate-400">{a.acquisitionDate} 取得</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatYen(a.acquisitionCost)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{a.usefulLife}年</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatYen(a.accumulatedDepreciation)}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        {formatYen(a.acquisitionCost - a.accumulatedDepreciation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form action={runDepreciationAction}>
            <input type="hidden" name="fiscalYearId" value={fy.id} />
            <button className="rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
              減価償却の仕訳を作成する（定額法・初年度は月割り）
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            同じ事業年度で二重に計上されないようにしているため、何度押しても増えません。
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle hint="すべての仕訳を日付順に">仕訳帳</SectionTitle>
        {entries.length === 0 ? (
          <Empty>まだ仕訳がありません</Empty>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <Card key={e.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {e.entryDate} {e.description}
                  </p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs text-slate-600">
                    {SOURCE_LABEL[e.sourceType] ?? e.sourceType}
                    {e.isAdjusting ? " ・決算整理" : ""}
                  </span>
                </div>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {e.lines.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="w-1/2 py-1.5">
                          {l.side === "debit" ? (
                            <span>
                              <span className="text-slate-400">借</span> {l.account.name}
                            </span>
                          ) : null}
                        </td>
                        <td className="w-1/2 py-1.5">
                          {l.side === "credit" ? (
                            <span>
                              <span className="text-slate-400">貸</span> {l.account.name}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{formatYen(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
