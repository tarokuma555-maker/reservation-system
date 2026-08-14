import Link from "next/link";
import { buildFinancialStatements, ensureFiscalYear } from "@/lib/accounting";
import { Card, LinkButton, ProvisionalNote, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 法人の計算書類4表。数値はすべて記録から積み上げている。 */
export default async function StatementsPage() {
  const fy = await ensureFiscalYear();
  const fs = await buildFinancialStatements(fy.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/accounting"
            className="inline-flex items-center gap-1 text-2xs font-bold text-slate-400 transition hover:text-brand-600"
          >
            <Icon name="arrowLeft" className="h-3 w-3" />
            売上と経費のまとめへ戻る
          </Link>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tighter text-ink">決算書</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {fs.fiscalYear.startDate} 〜 {fs.fiscalYear.endDate} のぶんです。
          </p>
        </div>
        <LinkButton href="/admin/accounting/tax" className="no-print">
          <Icon name="chart" className="h-4 w-4" />
          消費税のまとめを見る
        </LinkButton>
      </header>

      <div className="flex gap-3 rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3.5">
        <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-bold text-ink">決算書ってなに？</p>
          <p className="mt-1">
            1年間のお金の出入りを、決められた形にまとめた4枚の紙です。
            <b>税理士さんに渡す資料</b>であり、銀行から借り入れるときにも求められます。
            ここに出ている数字は、ふだんの入力からすべて自動で積み上がったものです。手で書き写す作業はありません。
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle hint="1年でいくら稼いで、いくら残ったか">損益計算書（P/L）</SectionTitle>
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
            hint={
              fs.balanceSheet.balanced
                ? "いま何を持っていて、いくら返す予定があるか（左右がぴったり合っています）"
                : "いま何を持っていて、いくら返す予定があるか（左右が合っていません）"
            }
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
          <SectionTitle hint="会社の元手が1年でどう増えたか">株主資本等変動計算書</SectionTitle>
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
          <SectionTitle hint="数字の数え方についての断り書き">個別注記表</SectionTitle>
          <Card className="space-y-3 text-sm leading-relaxed text-slate-700">
            <div>
              <p className="font-bold">1. 重要な会計方針</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                <li>高額な道具の目減りの数え方: 毎年おなじ額ずつ（買った年は月割り）</li>
                <li>売上を数えるタイミング: お仕事が終わった日（お金をいただいた日ではありません）</li>
                <li>消費税の扱い: 売上と消費税を分けて記録しています</li>
              </ul>
            </div>
            <div>
              <p className="font-bold">2. 貸借対照表に関する注記</p>
              <p className="mt-1 text-xs">
                道具の目減りぶんは、道具の値段から直接引かず、別の行として書いています。
              </p>
            </div>
            <div>
              <p className="font-bold">3. 損益計算書に関する注記</p>
              <p className="mt-1 text-xs">
                売上は、おうかがいする形とオンライン、そしてメニューの種類ごとに分けて記録しています。
              </p>
            </div>
            <p className="text-2xs text-slate-500">
              よくある書き方をあらかじめ入れてあります。変わったところだけ直していく形になります。
            </p>
          </Card>
        </section>
      </div>

      <ProvisionalNote>
        <b>この数字は、税理士さんに確認してもらってはじめて確定します。</b>
        税務署に出す申告書をつくって提出する仕事は、法律で税理士さんしかできないと決まっているため、
        このシステムでは行いません。かわりに、
        <b>税理士さんに渡す資料をそろえるところまで</b>を引き受けます
        （お金の動きの一覧、科目ごとの残高、この4枚、レシートや領収書の控え）。
        ふだんの入力さえしておけば、決算前の「あの書類どこ？」がなくなります。
      </ProvisionalNote>
    </div>
  );
}
