import Link from "next/link";
import { buildConsumptionTaxSummary, ensureFiscalYear } from "@/lib/accounting";
import { getSettings } from "@/lib/settings";
import { Card, ProvisionalNote, SectionTitle, StatTile } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const fy = await ensureFiscalYear();
  const [summary, settings] = await Promise.all([
    buildConsumptionTaxSummary(fy.id),
    getSettings(),
  ]);

  const advantage = summary.honsokuPayable - summary.kaniPayable;
  const kani = settings.taxMethod === "kani";

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/accounting"
          className="inline-flex items-center gap-1 text-2xs font-bold text-slate-400 transition hover:text-brand-600"
        >
          <Icon name="arrowLeft" className="h-3 w-3" />
          売上と経費のまとめへ戻る
        </Link>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tighter text-ink">
          消費税のまとめ
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {fy.name} のぶんです。いまは
          <b>{kani ? "かんたんな数え方（簡易課税）" : "きちんと数える方法（本則課税）"}</b>
          で計算しています。
        </p>
      </header>

      <div className="flex gap-3 rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3.5">
        <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-bold text-ink">消費税のしくみ</p>
          <p className="mt-1">
            お客様からいただいた代金には消費税が入っています。これは
            <b>あとで国に納めるために、いったんお預かりしているお金</b>です。
            一方、こちらが仕入れや道具の購入で払った消費税は差し引けます。
            その差額が、実際に納める金額になります。
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="お客様からいただいた代金（税ぬき）"
          value={formatYen(summary.taxableSalesExcludingTax)}
        />
        <StatTile
          label="そのうち、お預かりしている消費税"
          value={formatYen(summary.outputTax)}
        />
        <StatTile
          label="いま納めることになりそうな額"
          value={formatYen(summary.payable)}
          sub="この金額は使わずに取っておきましょう"
          tone="brand"
        />
      </div>

      <section>
        <SectionTitle hint="どちらを選ぶかは税理士さんとご相談ください。届け出の期限や、一度選ぶと2年変えられない決まりがあります">
          2つの数え方をくらべる
        </SectionTitle>
        <Card className="scroll-x p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left"></th>
                <th className="px-4 py-2.5 text-right">
                  きちんと数える
                  <span className="block font-normal text-slate-400">本則課税</span>
                </th>
                <th className="px-4 py-2.5 text-right">
                  かんたんに数える
                  <span className="block font-normal text-slate-400">簡易課税</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2.5">お預かりした消費税</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.outputTax)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.outputTax)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">
                  差し引ける消費税
                  <span className="mt-0.5 block text-2xs text-slate-500">
                    かんたんに数えるほうは、レシートを1枚ずつ数えず、売上の{" "}
                    {summary.deemedPurchaseRate}% とみなします
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
                <td className="px-4 py-2.5">納める額</td>
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
        <p className="mt-2.5 flex items-start gap-2 text-sm leading-relaxed text-slate-600">
          <Icon name="info" className="mt-1 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            いまの数字だと、
            <b>
              {advantage > 0
                ? `かんたんに数えるほうが ${formatYen(advantage)} 安くなります`
                : advantage < 0
                  ? `きちんと数えるほうが ${formatYen(-advantage)} 安くなります`
                  : "どちらでも同じ金額です"}
            </b>
            。ただし来年以降の見通しも含めて決める話なので、この数字を税理士さんにお見せください。
          </span>
        </p>
      </section>

      <section>
        <SectionTitle hint="相手のお店に登録番号があるかどうかで、差し引ける額が変わります">
          こちらが払った消費税の内訳
        </SectionTitle>
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2.5">
                  登録番号のあるお店で払ったぶん
                  <span className="mt-0.5 block text-2xs text-slate-500">まるごと差し引けます</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.inputTaxQualified)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5">
                  登録番号のないお店で払ったぶん
                  <span className="mt-0.5 block text-2xs text-slate-500">
                    いまは移行期間なので {summary.transitionalRate}% までは差し引けます
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.inputTaxNonQualified)}
                  <span className="mt-0.5 block text-2xs font-normal text-slate-500">
                    このうち{" "}
                    {formatYen(
                      Math.floor((summary.inputTaxNonQualified * summary.transitionalRate) / 100)
                    )}{" "}
                    が差し引けます
                  </span>
                </td>
              </tr>
              <tr className="border-t border-slate-300 font-bold">
                <td className="px-4 py-2.5">差し引ける合計</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatYen(summary.deductibleInputTax)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      <ProvisionalNote>
        移行期間の割合（いま {summary.transitionalRate}%）と、かんたんに数えるときの割合（
        {summary.deemedPurchaseRate}%）は<b>設定として持っています</b>。
        法律が変わっても、数字を書きかえるだけで計算に反映されます。
        なお、<b>税務署に出す申告書をつくって提出する仕事は税理士さんの担当</b>なので、
        このシステムでは行いません。
      </ProvisionalNote>
    </div>
  );
}
