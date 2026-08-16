import Link from "next/link";
import { buildFinancialStatements, ensureFiscalYear } from "@/lib/accounting";
import { Card, LinkButton, ProvisionalNote, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  BalanceSheetTable,
  EquityStatementTable,
  NotesBlock,
  ProfitAndLossTable,
} from "@/components/StatementsTables";

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
        <div className="no-print flex flex-wrap gap-2">
          <LinkButton href="/print/statements" target="_blank" rel="noreferrer noopener">
            <Icon name="receipt" className="h-4 w-4" />
            PDFで保存する
          </LinkButton>
          <LinkButton href="/admin/accounting/tax" variant="secondary">
            <Icon name="chart" className="h-4 w-4" />
            消費税のまとめを見る
          </LinkButton>
        </div>
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
            <ProfitAndLossTable pl={fs.profitAndLoss} />
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
            <BalanceSheetTable bs={fs.balanceSheet} />
          </Card>
        </section>

        <section>
          <SectionTitle hint="会社の元手が1年でどう増えたか">株主資本等変動計算書</SectionTitle>
          <Card className="p-0">
            <EquityStatementTable eq={fs.equityStatement} />
          </Card>
        </section>

        <section>
          <SectionTitle hint="数字の数え方についての断り書き">個別注記表</SectionTitle>
          <Card className="space-y-3">
            <NotesBlock />
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
