import { formatYen } from "@/lib/time";

export type InvoiceDocumentProps = {
  type: string;
  invoiceNumber: string;
  issueDate: string;
  issuerName: string;
  issuerAddress: string;
  registrationNumber: string;
  recipientName: string;
  totalAmount: number;
  subtotalByTaxRate: Record<string, number>;
  taxByTaxRate: Record<string, number>;
  lines: {
    id: string;
    transactionDate: string;
    description: string;
    quantity: number;
    amount: number;
    isReducedTaxRate: boolean;
  }[];
  status: string;
  voidReason?: string | null;
  correctionReason?: string | null;
  roundingLabel: string;
};

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "適格返還請求書",
  corrected: "修正インボイス",
};

/** 交付する書類の中身。画面表示にもPDF生成にも同じものを使う。 */
export default function InvoiceDocument(props: InvoiceDocumentProps) {
  const rates = Object.keys(props.taxByTaxRate).sort();

  return (
    <div className="bg-white p-8 text-[#1d2b2a]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">
            {INVOICE_TYPE_LABEL[props.type] ?? props.type}
          </h1>
          {props.status === "void" ? (
            <p className="mt-1 text-sm font-bold text-rose-600">※ この書類は無効です</p>
          ) : null}
        </div>
        <div className="text-right text-xs text-slate-600">
          <p>No. {props.invoiceNumber}</p>
          <p>発行日 {props.issueDate}</p>
        </div>
      </div>

      {/* ⑥ 交付を受ける事業者の氏名または名称 */}
      <p className="mt-6 border-b border-slate-400 pb-1 text-lg">{props.recipientName}</p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs text-slate-500">合計金額（税込）</p>
          <p className="text-3xl font-bold tabular-nums">{formatYen(props.totalAmount)}</p>
        </div>

        {/* ① 発行事業者の名称および登録番号 */}
        <div className="text-right text-xs leading-relaxed text-slate-700">
          <p className="text-sm font-bold">{props.issuerName}</p>
          <p>{props.issuerAddress}</p>
          <p className="mt-1 font-medium">登録番号 {props.registrationNumber}</p>
        </div>
      </div>

      {/* ②③ 取引年月日・取引内容 */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-y border-slate-300 text-xs text-slate-600">
            <th className="py-2 text-left">取引年月日</th>
            <th className="py-2 text-left">内容</th>
            <th className="py-2 text-right">数量</th>
            <th className="py-2 text-right">金額（税込）</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-2 tabular-nums text-slate-600">{l.transactionDate}</td>
              <td className="py-2">
                {l.description}
                {l.isReducedTaxRate ? <span className="ml-1 text-xs">※軽減税率対象</span> : null}
              </td>
              <td className="py-2 text-right tabular-nums">{l.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatYen(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ④⑤ 税率ごとに区分した対価の額と消費税額 */}
      <div className="mt-4 flex justify-end">
        <table className="w-full max-w-xs text-sm">
          <tbody>
            {rates.map((rate) => (
              <tr key={rate}>
                <td className="py-1 text-slate-600">{rate}％対象（税抜）</td>
                <td className="py-1 text-right tabular-nums">
                  {formatYen(props.subtotalByTaxRate[rate] ?? 0)}
                </td>
              </tr>
            ))}
            {rates.map((rate) => (
              <tr key={`t-${rate}`}>
                <td className="py-1 text-slate-600">消費税（{rate}％）</td>
                <td className="py-1 text-right tabular-nums">
                  {formatYen(props.taxByTaxRate[rate] ?? 0)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-300">
              <td className="py-2 font-bold">合計（税込）</td>
              <td className="py-2 text-right font-bold tabular-nums">
                {formatYen(props.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {props.correctionReason ? (
        <p className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
          修正理由: {props.correctionReason}
        </p>
      ) : null}
      {props.voidReason ? (
        <p className="mt-4 rounded bg-rose-50 p-3 text-xs text-rose-600">
          無効理由: {props.voidReason}
        </p>
      ) : null}

      <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
        この書類は適格請求書等保存方式（インボイス制度）の記載事項を満たしています。
        消費税額は税率ごとに1回のみ端数処理（{props.roundingLabel}）しています。
      </p>
    </div>
  );
}
