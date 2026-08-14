import { prisma } from "@/lib/db";
import { ocrMode, SAMPLE_RECEIPTS } from "@/lib/ocr";
import { ensureChartOfAccounts } from "@/lib/accounting";
import { Card, Empty, ModeBanner, ProvisionalNote, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import ReceiptScanner from "@/components/ReceiptScanner";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

const INVOICE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  qualified: { label: "税金が引ける", cls: "bg-good-50 text-good-700 ring-good-100" },
  non_qualified: { label: "登録番号なし", cls: "bg-ocean-100 text-ocean-700 ring-ocean-500/25" },
  small_amount_exception: { label: "少額のためOK", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export default async function ExpensesPage() {
  await ensureChartOfAccounts();

  const [accounts, expenses] = await Promise.all([
    prisma.account.findMany({ where: { type: "expense" }, orderBy: { sortOrder: "asc" } }),
    prisma.expense.findMany({
      orderBy: { expenseDate: "desc" },
      take: 30,
      include: { account: true, document: true },
    }),
  ]);

  const live = ocrMode() === "live";
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">経費を入れる</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          レシートを撮るだけで、日にち・お店・金額を読み取ります。
          どの費用にあたるかも自動でえらんでくれるので、あとは確認して入れるだけです。
        </p>
      </header>

      <ModeBanner
        live={live}
        liveTitle="写真から読み取ります"
        mockTitle="いまは お試しモード です（用意したレシートの文面を使います）"
      >
        {live ? (
          <p>スマホで撮ったレシートの写真を、そのまま読み取って入力します。</p>
        ) : (
          <p>
            読み取ったあとの処理（日にち・金額・お店・登録番号のとり出しと、費用の種類の判定）は
            本番とまったく同じです。ここで見えている動きが、そのまま本番の動きになります。
          </p>
        )}
      </ModeBanner>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle hint="レシートをえらぶ → 中身を確認する → 入れる、の3ステップです">
            レシートから入れる
          </SectionTitle>
          <Card>
            <ReceiptScanner
              accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
              samples={Object.entries(SAMPLE_RECEIPTS).map(([key, v]) => ({ key, label: v.label }))}
              mode={ocrMode()}
            />
          </Card>
        </section>

        <section>
          <SectionTitle hint={`${expenses.length}件 ／ 合計 ${formatYen(total)}`}>
            入れた経費
          </SectionTitle>
          {expenses.length === 0 ? (
            <Empty>まだ1件も入っていません。左のレシートからどうぞ。</Empty>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {expenses.map((e) => {
                const s = INVOICE_STATUS_LABEL[e.invoiceStatus] ?? INVOICE_STATUS_LABEL.qualified;
                return (
                  <div key={e.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{e.vendorName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {e.expenseDate} ／ {e.account.name}
                        </p>
                        {e.vendorRegistrationNumber ? (
                          <p className="text-2xs text-slate-400">
                            相手の登録番号 {e.vendorRegistrationNumber}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 space-y-1 text-right">
                        <p className="text-sm font-bold tabular-nums text-ink">
                          {formatYen(e.amount)}
                        </p>
                        <span
                          className={`inline-block rounded-pill px-2 py-0.5 text-2xs font-bold ring-1 ring-inset ${s.cls}`}
                        >
                          {s.label}
                        </span>
                      </div>
                    </div>
                    {e.journalEntryId ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-2xs text-good-700">
                        <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
                        帳簿に書きこみました
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>

      <ProvisionalNote>
        「税金が引ける」と出るのは、相手のお店に登録番号があるレシートです。登録番号がないお店のぶんは
        消費税を差し引けない決まりになっているので、区別して記録しています。
        費用の種類は、お店の名前とレシートの言葉から見当をつけています（「ENEOS」ならガソリン代、
        「カインズ」なら消耗品、など）。よく使うお店が決まってきたら、この見当のつけ方も合わせていきます。
      </ProvisionalNote>
    </div>
  );
}
