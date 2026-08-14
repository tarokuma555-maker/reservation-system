import { prisma } from "@/lib/db";
import { ocrMode, SAMPLE_RECEIPTS } from "@/lib/ocr";
import { ensureChartOfAccounts } from "@/lib/accounting";
import { Card, Empty, ProvisionalNote, SectionTitle } from "@/components/ui";
import ReceiptScanner from "@/components/ReceiptScanner";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

const INVOICE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  qualified: { label: "適格請求書あり", cls: "bg-good-100 text-good-700" },
  non_qualified: { label: "インボイスなし", cls: "bg-ocean-100 text-ocean-600" },
  small_amount_exception: { label: "少額特例", cls: "bg-slate-100 text-slate-600" },
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
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">経費とレシート</h1>
        <p className="text-sm text-slate-500">
          レシートを読み取って、勘定科目の推定から仕訳の作成までを一度に行います
        </p>
      </header>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          live ? "border-good-100 bg-good-50 text-good-700" : "border-warn-100 bg-warn-50 text-warn-700"
        }`}
      >
        <p className="font-bold">
          {live ? "本番接続: Cloud Vision APIで読み取ります" : "お試しモード: サンプルのレシート文面を使います"}
        </p>
        {!live ? (
          <p className="mt-1 text-xs leading-relaxed">
            <code>GOOGLE_VISION_API_KEY</code> を設定すると、撮影した写真から実際に読み取ります。
            <b>読み取った文字列を解析する処理（日付・金額・取引先・登録番号の抽出）は同じコード</b>を通るため、
            ここで見えている挙動がそのまま本番の挙動です。
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>レシートから登録する</SectionTitle>
          <Card>
            <ReceiptScanner
              accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
              samples={Object.entries(SAMPLE_RECEIPTS).map(([key, v]) => ({ key, label: v.label }))}
              mode={ocrMode()}
            />
          </Card>
        </section>

        <section>
          <SectionTitle hint={`登録済み ${expenses.length}件 / 合計 ${formatYen(total)}`}>
            登録した経費
          </SectionTitle>
          {expenses.length === 0 ? (
            <Empty>まだ登録がありません</Empty>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {expenses.map((e) => {
                const s = INVOICE_STATUS_LABEL[e.invoiceStatus] ?? INVOICE_STATUS_LABEL.qualified;
                return (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{e.vendorName}</p>
                        <p className="text-xs text-slate-500">
                          {e.expenseDate} ／ {e.account.name} ／ {e.taxCategory}
                        </p>
                        {e.vendorRegistrationNumber ? (
                          <p className="text-2xs text-slate-400">
                            登録番号 {e.vendorRegistrationNumber}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium tabular-nums">{formatYen(e.amount)}</p>
                        <span className={`rounded px-2 py-0.5 text-2xs ${s.cls}`}>{s.label}</span>
                      </div>
                    </div>
                    {e.journalEntryId ? (
                      <p className="mt-1 text-2xs text-brand-700">帳簿に記録済み</p>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>

      <ProvisionalNote>
        勘定科目の推定は、取引先名とレシート本文のキーワードで判定しています（例:「ENEOS」→ 燃料費、
        「カインズ」→ 消耗品費）。実際に使う科目が決まったら、判定ルールも合わせて調整します。
      </ProvisionalNote>
    </div>
  );
}
