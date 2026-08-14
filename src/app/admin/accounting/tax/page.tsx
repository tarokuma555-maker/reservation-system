import Link from "next/link";
import { buildConsumptionTaxSummary, ensureFiscalYear } from "@/lib/accounting";
import { getSettings } from "@/lib/settings";
import { Card, ProvisionalNote, SectionTitle } from "@/components/ui";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const fy = await ensureFiscalYear();
  const [summary, settings] = await Promise.all([
    buildConsumptionTaxSummary(fy.id),
    getSettings(),
  ]);

  const advantage = summary.honsokuPayable - summary.kaniPayable;

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/accounting" className="text-xs text-slate-500 hover:underline">
          ← 帳簿へ戻る
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tighter text-ink">消費税の集計</h1>
        <p className="text-sm text-slate-500">
          {fy.name} ／ 現在の設定: {settings.taxMethod === "kani" ? "簡易課税" : "本則課税"}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">課税売上（税抜）</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatYen(summary.taxableSalesExcludingTax)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">預かった消費税（仮受）</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{formatYen(summary.outputTax)}</p>
        </Card>
        <Card className="border-brand-700/20 bg-brand-sheen text-white">
          <p className="text-2xs font-bold tracking-wide text-white/80">納付見込み額（現在の方式）</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tighter tabular-nums">
            {formatYen(summary.payable)}
          </p>
        </Card>
      </div>

      <section>
        <SectionTitle hint="どちらが有利かの判断は税務判断のため、税理士にご確認ください">
          本則課税と簡易課税の試算
        </SectionTitle>
        <Card className="scroll-x p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">項目</th>
                <th className="px-4 py-2.5 text-right">本則課税</th>
                <th className="px-4 py-2.5 text-right">簡易課税</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2">預かった消費税</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(summary.outputTax)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(summary.outputTax)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2">
                  控除できる消費税
                  <span className="ml-2 text-xs text-slate-500">
                    （簡易はみなし仕入率 {summary.deemedPurchaseRate}%）
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.deductibleInputTax)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.outputTax - summary.kaniPayable)}
                </td>
              </tr>
              <tr className="border-t border-slate-300 font-bold">
                <td className="px-4 py-2">納付額</td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    summary.honsokuPayable <= summary.kaniPayable ? "text-brand-700" : ""
                  }`}
                >
                  {formatYen(summary.honsokuPayable)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    summary.kaniPayable < summary.honsokuPayable ? "text-brand-700" : ""
                  }`}
                >
                  {formatYen(summary.kaniPayable)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-sm text-slate-600">
          現時点の数字では、
          <b>
            {advantage > 0
              ? `簡易課税のほうが ${formatYen(advantage)} 少なくなります`
              : advantage < 0
                ? `本則課税のほうが ${formatYen(-advantage)} 少なくなります`
                : "どちらも同額です"}
          </b>
          。ただし届出の期限や2年継続の縛りがあるため、実際の選択は税理士とご相談ください。
        </p>
      </section>

      <section>
        <SectionTitle hint="インボイスの有無で控除できる額が変わります">
          支払った消費税（仮払）の内訳
        </SectionTitle>
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2">適格請求書あり（全額控除）</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.inputTaxQualified)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2">
                  適格請求書なし
                  <span className="ml-2 text-xs text-slate-500">
                    （経過措置 {summary.transitionalRate}% を適用）
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.inputTaxNonQualified)}
                  <span className="ml-2 text-xs text-slate-500">
                    → 控除{" "}
                    {formatYen(
                      Math.floor((summary.inputTaxNonQualified * summary.transitionalRate) / 100)
                    )}
                  </span>
                </td>
              </tr>
              <tr className="border-t border-slate-300 font-bold">
                <td className="px-4 py-2">控除できる合計</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.deductibleInputTax)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      <ProvisionalNote>
        経過措置の控除割合（現在 {summary.transitionalRate}%）と、みなし仕入率（
        {summary.deemedPurchaseRate}%）は<b>設定値として持っています</b>。
        税制改正があっても、設定を変えるだけで集計に反映されます。
        <b>消費税申告書の作成と提出は税理士の業務のため、本システムでは行いません。</b>
      </ProvisionalNote>
    </div>
  );
}
