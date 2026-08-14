import Link from "next/link";
import { buildFinancialStatements, ensureFiscalYear } from "@/lib/accounting";
import { Card, ProvisionalNote, SectionTitle } from "@/components/ui";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 法人の計算書類4表。数値はすべて仕訳から積み上げている。 */
export default async function StatementsPage() {
  const fy = await ensureFiscalYear();
  const fs = await buildFinancialStatements(fy.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/accounting" className="text-xs text-slate-500 hover:underline">
            ← 帳簿へ戻る
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tighter text-ink">決算書（計算書類）</h1>
          <p className="text-sm text-slate-500">
            {fs.fiscalYear.startDate} 〜 {fs.fiscalYear.endDate}
          </p>
        </div>
        <Link
          href="/admin/accounting/tax"
          className="no-print rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          消費税の集計を見る
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>損益計算書（P/L）</SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <td className="px-4 py-2" colSpan={2}>
                    売上高
                  </td>
                </tr>
                {fs.profitAndLoss.revenues.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-1.5 pl-8">{r.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(r.amount)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-1.5">売上高 計</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.profitAndLoss.totalRevenue)}
                  </td>
                </tr>

                <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <td className="px-4 py-2" colSpan={2}>
                    販売費及び一般管理費
                  </td>
                </tr>
                {fs.profitAndLoss.expenses.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-1.5 pl-8">{r.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(r.amount)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-1.5">費用 計</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.profitAndLoss.totalExpense)}
                  </td>
                </tr>

                <tr className="border-t border-slate-300 font-bold">
                  <td className="px-4 py-2">経常利益</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatYen(fs.profitAndLoss.ordinaryIncome)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5">法人税等</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.profitAndLoss.corporateTax)}
                  </td>
                </tr>
                <tr className="border-t border-slate-300 bg-brand-50 font-bold">
                  <td className="px-4 py-2">当期純利益</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatYen(fs.profitAndLoss.netIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <SectionTitle
            hint={fs.balanceSheet.balanced ? "資産 = 負債 + 純資産（一致）" : "一致していません"}
          >
            貸借対照表（B/S）
          </SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <td className="px-4 py-2" colSpan={2}>
                    資産の部
                  </td>
                </tr>
                {fs.balanceSheet.assets.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-1.5 pl-8">{r.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(r.amount)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-1.5">資産合計</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.balanceSheet.totalAssets)}
                  </td>
                </tr>

                <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <td className="px-4 py-2" colSpan={2}>
                    負債の部
                  </td>
                </tr>
                {fs.balanceSheet.liabilities.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-1.5 pl-8">{r.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(r.amount)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-1.5">負債合計</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.balanceSheet.totalLiabilities)}
                  </td>
                </tr>

                <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <td className="px-4 py-2" colSpan={2}>
                    純資産の部
                  </td>
                </tr>
                {fs.balanceSheet.equity.map((r) => (
                  <tr key={r.code}>
                    <td className="px-4 py-1.5 pl-8">{r.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(r.amount)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-1.5">純資産合計</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {formatYen(fs.balanceSheet.totalEquity)}
                  </td>
                </tr>

                <tr className="border-t border-slate-300 bg-brand-50 font-bold">
                  <td className="px-4 py-2">負債・純資産合計</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatYen(fs.balanceSheet.totalLiabilities + fs.balanceSheet.totalEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <SectionTitle>株主資本等変動計算書</SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 text-left">項目</th>
                  <th className="px-4 py-2.5 text-right">当期首残高</th>
                  <th className="px-4 py-2.5 text-right">当期変動額</th>
                  <th className="px-4 py-2.5 text-right">当期末残高</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fs.equityStatement.rows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(r.opening)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(r.change)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatYen(r.closing)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <SectionTitle>個別注記表</SectionTitle>
          <Card className="space-y-3 text-sm leading-relaxed text-slate-700">
            <div>
              <p className="font-bold">1. 重要な会計方針</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                <li>固定資産の減価償却の方法: 定額法（取得初年度は月割計算）</li>
                <li>収益の計上基準: サービスの提供が完了した日をもって計上（発生主義）</li>
                <li>消費税等の会計処理: 税抜方式</li>
              </ul>
            </div>
            <div>
              <p className="font-bold">2. 貸借対照表に関する注記</p>
              <p className="mt-1 text-xs">
                減価償却累計額は資産から直接控除せず、控除科目として表示しています。
              </p>
            </div>
            <div>
              <p className="font-bold">3. 損益計算書に関する注記</p>
              <p className="mt-1 text-xs">
                売上高は提供形態（訪問・オンライン）およびサービス種別ごとに区分して管理しています。
              </p>
            </div>
            <p className="text-2xs text-slate-500">
              ひな形です。変更のあった項目のみ編集する運用を想定しています。
            </p>
          </Card>
        </section>
      </div>

      <ProvisionalNote>
        <b>この数値は税理士の確認を経て確定するものです。</b>
        法人税申告書・別表の作成と提出は税理士の業務のため、本システムは行いません。
        必要な資料（記録の一覧（仕訳帳）・総勘定元帳・科目ごとの残高・計算書類・レシート・書類）をそろえるところまでを担います。
      </ProvisionalNote>
    </div>
  );
}
