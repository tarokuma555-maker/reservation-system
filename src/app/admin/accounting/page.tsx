import { prisma } from "@/lib/db";
import { ensureChartOfAccounts, ensureFiscalYear, trialBalance } from "@/lib/accounting";
import { Button, Card, Empty, LinkButton, SectionTitle, StatTile } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";
import { runDepreciationAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  asset: "持っているもの",
  liability: "返すべきもの",
  equity: "自分のぶん",
  revenue: "売上",
  expense: "経費",
};

const SOURCE_LABEL: Record<string, string> = {
  invoice: "お仕事の売上",
  payment: "入金",
  expense: "経費",
  depreciation: "道具の目減り",
  manual: "手で入れたもの",
  adjustment: "年度末の調整",
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

  // 難しい言葉を出す前に、いちばん知りたい3つの数字を先に出す。
  const revenue = tb.rows
    .filter((r) => r.type === "revenue")
    .reduce((s, r) => s + Math.abs(r.balance), 0);
  const expense = tb.rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + Math.abs(r.balance), 0);
  const profit = revenue - expense;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink">売上と経費のまとめ</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {fy.startDate} 〜 {fy.endDate} のぶんです。
            お仕事を「終わった」にしたり、レシートを入れたりすると、ここに自動でたまっていきます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/accounting/statements" variant="primary">
            <Icon name="book" className="h-4 w-4" />
            決算書を見る
          </LinkButton>
          <LinkButton href="/admin/accounting/tax">
            <Icon name="chart" className="h-4 w-4" />
            消費税のまとめ
          </LinkButton>
        </div>
      </header>

      <section>
        <SectionTitle hint="この3つが分かれば、ふだんは十分です">いまの数字</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="入ってきたお金（売上）" value={formatYen(revenue)} tone="brand" />
          <StatTile label="出ていったお金（経費）" value={formatYen(expense)} />
          <StatTile
            label="のこり（もうけ）"
            value={profit < 0 ? `${formatYen(-profit)} の赤字` : formatYen(profit)}
            sub={
              profit < 0
                ? "いまは経費のほうが多い状態です"
                : "ここに税金がかかります。使わずに取っておきましょう"
            }
            tone={profit < 0 ? "alert" : "plain"}
          />
        </div>
      </section>

      <section>
        <SectionTitle hint="決算のときだけ必要な作業です。ふだんは触らなくて大丈夫です">
          年に一度の作業
        </SectionTitle>
        <Card>
          <p className="text-sm font-bold text-ink">高かった道具の「目減り」を記録する</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            10万円以上する道具（掃除機や車など）は、買った年に全部を経費にできない決まりです。
            使える年数で割って、少しずつ経費にしていきます。その計算をボタン1つで行います。
          </p>

          {assets.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              いまのところ、対象になる道具はありません。
            </p>
          ) : (
            <div className="scroll-x mt-3">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-2xs font-bold tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left">道具</th>
                    <th className="py-2 text-right">買ったときの値段</th>
                    <th className="py-2 text-right">使える年数</th>
                    <th className="py-2 text-right">これまでに経費にしたぶん</th>
                    <th className="py-2 text-right">のこり</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2">
                        {a.name}
                        <span className="ml-2 text-2xs text-slate-400">
                          {a.acquisitionDate} に購入
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatYen(a.acquisitionCost)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{a.usefulLife}年</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatYen(a.accumulatedDepreciation)}
                      </td>
                      <td className="py-2 text-right font-bold tabular-nums">
                        {formatYen(a.acquisitionCost - a.accumulatedDepreciation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form action={runDepreciationAction} className="mt-4">
            <input type="hidden" name="fiscalYearId" value={fy.id} />
            <Button type="submit" variant="secondary">
              <Icon name="refresh" className="h-4 w-4" />
              今年ぶんの目減りを記録する
            </Button>
          </form>
          <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            何度押しても、同じ年のぶんが二重に記録されることはありません。安心して押してください。
          </p>
        </Card>
      </section>

      {/* ここから先は税理士さんとやりとりする用。ふだんは閉じておく。 */}
      <section>
        <SectionTitle hint="税理士さんに見せるときや、数字の内訳を確かめたいときに開いてください">
          くわしい帳簿
        </SectionTitle>

        <div
          className={`mb-3 flex gap-3 rounded-card border px-4 py-3.5 ${
            tb.balanced ? "border-good-100 bg-good-50" : "border-bad-100 bg-bad-50"
          }`}
        >
          <Icon
            name={tb.balanced ? "check" : "alert"}
            className={`mt-0.5 h-4 w-4 shrink-0 ${tb.balanced ? "text-good-600" : "text-bad-600"}`}
          />
          <div className="text-xs leading-relaxed">
            <p className={`font-bold ${tb.balanced ? "text-good-700" : "text-bad-700"}`}>
              {tb.balanced
                ? "帳簿の左右がぴったり合っています"
                : "帳簿の左右が合っていません"}
            </p>
            <p className="mt-0.5 text-slate-600">
              帳簿はすべての記録を左右に分けて書く決まりで、この2つが合わないと帳簿として認められません。
              合わない記録はそもそも保存できないようにしてあるので、ここが赤くなることはありません。
            </p>
          </div>
        </div>

        <details className="group rounded-card border border-slate-200/80 bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:text-brand-700">
            <Icon name="chevronRight" className="h-4 w-4 transition group-open:rotate-90" />
            なにに、いくら使ったかを見る
          </summary>
          <div className="scroll-x border-t border-slate-100">
            {tb.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                まだ記録がありません。お仕事を「終わった」にするか、レシートを入れてみてください。
              </p>
            ) : (
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-2.5 text-left">なにに使ったか</th>
                    <th className="px-4 py-2.5 text-left">種類</th>
                    <th className="px-4 py-2.5 text-right">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tb.rows.map((r) => (
                    <tr key={r.code}>
                      <td className="px-5 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{TYPE_LABEL[r.type]}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatYen(Math.abs(r.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-300 bg-brand-50/60 text-sm font-bold">
                  <tr>
                    <td className="px-5 py-2.5" colSpan={2}>
                      左右それぞれの合計
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatYen(tb.totalDebit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </details>

        <details className="group mt-3 rounded-card border border-slate-200/80 bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:text-brand-700">
            <Icon name="chevronRight" className="h-4 w-4 transition group-open:rotate-90" />
            お金の動きを1件ずつ見る（新しい順）
          </summary>
          <div className="border-t border-slate-100 p-4">
            {entries.length === 0 ? (
              <Empty>まだ記録がありません</Empty>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200/80 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-ink">
                        <span className="tabular-nums text-slate-500">{e.entryDate}</span>{" "}
                        {e.description}
                      </p>
                      <span className="rounded-pill bg-slate-100 px-2.5 py-0.5 text-2xs font-bold text-slate-600">
                        {SOURCE_LABEL[e.sourceType] ?? e.sourceType}
                        {e.isAdjusting ? " ・年度末の調整" : ""}
                      </span>
                    </div>
                    <table className="mt-2 w-full text-sm">
                      <tbody>
                        {e.lines.map((l) => (
                          <tr key={l.id} className="border-t border-slate-100">
                            <td className="w-1/2 py-1.5 text-xs">
                              {l.side === "debit" ? l.account.name : null}
                            </td>
                            <td className="w-1/2 py-1.5 text-xs">
                              {l.side === "credit" ? l.account.name : null}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              {formatYen(l.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
