import type { FinancialStatements } from "@/lib/accounting";
import { formatYen } from "@/lib/time";

/**
 * 決算書4表の中身。
 *
 * 画面用と印刷（PDF）用の両方から、同じものを読む。
 * 別々に書くと、片方だけ直したときに数字の並びが食い違う。
 */

type FS = FinancialStatements;

export function ProfitAndLossTable({ pl }: { pl: FS["profitAndLoss"] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100">
        <GroupRow>売上高</GroupRow>
        {pl.revenues.map((r) => (
          <ItemRow key={r.code} name={r.name} amount={r.amount} />
        ))}
        <SubtotalRow name="売上高 計" amount={pl.totalRevenue} />

        <GroupRow>販売費及び一般管理費</GroupRow>
        {pl.expenses.map((r) => (
          <ItemRow key={r.code} name={r.name} amount={r.amount} />
        ))}
        <SubtotalRow name="費用 計" amount={pl.totalExpense} />

        <tr className="border-t border-slate-300 font-bold">
          <td className="px-4 py-2">経常利益</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(pl.ordinaryIncome)}</td>
        </tr>
        <ItemRow name="法人税等" amount={pl.corporateTax} indent={false} />
        <tr className="border-t border-slate-300 bg-brand-50 font-bold">
          <td className="px-4 py-2">当期純利益</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(pl.netIncome)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function BalanceSheetTable({ bs }: { bs: FS["balanceSheet"] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100">
        <GroupRow>資産の部</GroupRow>
        {bs.assets.map((r) => (
          <ItemRow key={r.code} name={r.name} amount={r.amount} />
        ))}
        <SubtotalRow name="資産合計" amount={bs.totalAssets} />

        <GroupRow>負債の部</GroupRow>
        {bs.liabilities.map((r) => (
          <ItemRow key={r.code} name={r.name} amount={r.amount} />
        ))}
        <SubtotalRow name="負債合計" amount={bs.totalLiabilities} />

        <GroupRow>純資産の部</GroupRow>
        {bs.equity.map((r) => (
          <ItemRow key={r.code} name={r.name} amount={r.amount} />
        ))}
        <SubtotalRow name="純資産合計" amount={bs.totalEquity} />

        <tr className="border-t border-slate-300 bg-brand-50 font-bold">
          <td className="px-4 py-2">負債・純資産合計</td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {formatYen(bs.totalLiabilities + bs.totalEquity)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EquityStatementTable({ eq }: { eq: FS["equityStatement"] }) {
  return (
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
        {eq.rows.map((r) => (
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
  );
}

export function NotesBlock() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
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
    </div>
  );
}

/* ---------------- 行の部品 ---------------- */

function GroupRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
      <td className="px-4 py-2" colSpan={2}>
        {children}
      </td>
    </tr>
  );
}

function ItemRow({
  name,
  amount,
  indent = true,
}: {
  name: string;
  amount: number;
  indent?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-1.5 ${indent ? "pl-8" : ""}`}>{name}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(amount)}</td>
    </tr>
  );
}

function SubtotalRow({ name, amount }: { name: string; amount: number }) {
  return (
    <tr className="font-medium">
      <td className="px-4 py-1.5">{name}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">{formatYen(amount)}</td>
    </tr>
  );
}
