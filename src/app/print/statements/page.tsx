import { buildFinancialStatements, ensureFiscalYear } from "@/lib/accounting";
import { getSettings } from "@/lib/settings";
import {
  BalanceSheetTable,
  EquityStatementTable,
  NotesBlock,
  ProfitAndLossTable,
} from "@/components/StatementsTables";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * 決算書のPDF化専用ページ。
 *
 * サーバー側でPDFを作る道もあるが、この置き場所には日本語を描ける
 * ブラウザが無く、その場では作れない。ブラウザの印刷から
 * 「PDFとして保存」を選んでいただく形にしている。
 * どの端末でも同じ結果になり、フォントの心配も要らない。
 */
export default async function PrintStatements() {
  const [settings, fy] = await Promise.all([getSettings(), ensureFiscalYear()]);
  const fs = await buildFinancialStatements(fy.id);

  return (
    <div className="mx-auto max-w-[820px] px-8 py-10 text-ink">
      <PrintTrigger />

      <p className="no-print mb-6 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs leading-relaxed text-slate-700">
        印刷の画面が出たら、送り先に<b>「PDFとして保存」</b>をえらんでください。
        出てこない場合は、キーボードの <b>⌘P</b>（Windowsは <b>Ctrl+P</b>）で開けます。
      </p>

      <header className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold tracking-tight">決算書</h1>
        <p className="mt-1 text-sm">{settings.issuerName}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          対象期間: {fs.fiscalYear.startDate} 〜 {fs.fiscalYear.endDate}
        </p>
      </header>

      <Sheet title="損益計算書（P/L）">
        <ProfitAndLossTable pl={fs.profitAndLoss} />
      </Sheet>

      <Sheet title="貸借対照表（B/S）" breakBefore>
        <BalanceSheetTable bs={fs.balanceSheet} />
        {!fs.balanceSheet.balanced ? (
          <p className="mt-2 px-4 text-xs text-bad-700">
            ※ 左右の合計が一致していません。記帳に漏れがある可能性があります。
          </p>
        ) : null}
      </Sheet>

      <Sheet title="株主資本等変動計算書" breakBefore>
        <EquityStatementTable eq={fs.equityStatement} />
      </Sheet>

      <Sheet title="個別注記表" breakBefore>
        <div className="px-4 py-3">
          <NotesBlock />
        </div>
      </Sheet>

      <p className="mt-8 border-t border-slate-300 pt-3 text-2xs leading-relaxed text-slate-600">
        この書類は、日々の記録から自動で集計したものです。
        税務署に提出する申告書は、税理士にご確認のうえ作成してください。
      </p>
    </div>
  );
}

/** 1表ぶん。紙をまたぐときに表の途中で切れないようにする。 */
function Sheet({
  title,
  children,
  breakBefore = false,
}: {
  title: string;
  children: React.ReactNode;
  breakBefore?: boolean;
}) {
  return (
    <section className={`mb-8 ${breakBefore ? "print-break-before" : ""}`}>
      <h2 className="mb-2 text-base font-bold tracking-tight">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-300">{children}</div>
    </section>
  );
}
