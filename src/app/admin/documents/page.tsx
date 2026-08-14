import { prisma } from "@/lib/db";
import { Card, Empty, SectionTitle } from "@/components/ui";
import { formatYen, todayStr } from "@/lib/time";
import { deleteDocumentAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  issued_invoice: "交付した請求書・領収書の写し",
  received_receipt: "受け取ったレシート",
  received_invoice: "受け取った請求書",
};

/**
 * 証憑ボックス。
 * 電子帳簿保存法の検索要件（取引年月日・取引金額・取引先）で絞り込める。
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; min?: string; max?: string; party?: string }>;
}) {
  const q = await searchParams;

  const documents = await prisma.document.findMany({
    where: {
      deletedAt: null,
      ...(q.from || q.to
        ? { transactionDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
      ...(q.min || q.max
        ? {
            transactionAmount: {
              ...(q.min ? { gte: Number(q.min) } : {}),
              ...(q.max ? { lte: Number(q.max) } : {}),
            },
          }
        : {}),
      ...(q.party ? { counterpartyName: { contains: q.party } } : {}),
    },
    orderBy: { transactionDate: "desc" },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 3 } },
    take: 50,
  });

  const today = todayStr();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold text-ink">証憑ボックス</h1>
        <p className="text-sm text-slate-500">
          電子帳簿保存法の要件に沿って保存しています（訂正削除の履歴を残し、保存期限内は削除できません）
        </p>
      </header>

      <section>
        <SectionTitle hint="日付と金額は範囲で、取引先は部分一致で検索できます">
          検索（法令が求める3項目）
        </SectionTitle>
        <Card>
          <form className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">
              取引年月日（から）
              <input type="date" name="from" defaultValue={q.from} className={inputCls} />
            </label>
            <label className="text-xs text-slate-500">
              （まで）
              <input type="date" name="to" defaultValue={q.to} className={inputCls} />
            </label>
            <label className="text-xs text-slate-500">
              金額（以上）
              <input type="number" name="min" defaultValue={q.min} className={`${inputCls} w-28`} />
            </label>
            <label className="text-xs text-slate-500">
              （以下）
              <input type="number" name="max" defaultValue={q.max} className={`${inputCls} w-28`} />
            </label>
            <label className="min-w-[160px] flex-1 text-xs text-slate-500">
              取引先
              <input name="party" defaultValue={q.party} className={`${inputCls} w-full`} />
            </label>
            <button className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white">
              検索
            </button>
            <a href="/admin/documents" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              条件をクリア
            </a>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle hint={`${documents.length}件`}>保存されている証憑</SectionTitle>
        {documents.length === 0 ? (
          <Empty>該当する証憑はありません</Empty>
        ) : (
          <div className="space-y-3">
            {documents.map((d) => (
              <Card key={d.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{d.counterpartyName}</p>
                    <p className="text-xs text-slate-500">
                      {KIND_LABEL[d.kind] ?? d.kind} ／ 取引年月日 {d.transactionDate}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-slate-400">{d.filePath}</p>
                    {d.fileHash ? (
                      <p className="text-[11px] text-slate-400">
                        SHA-256: {d.fileHash.slice(0, 16)}…（改ざん検知用）
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">{formatYen(d.transactionAmount)}</p>
                    <p className="text-[11px] text-slate-500">保存期限 {d.retentionUntil}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <ul className="space-y-0.5 text-[11px] text-slate-500">
                    {d.logs.map((l) => (
                      <li key={l.id}>
                        {l.action} ／ {l.detail || "—"} ／{" "}
                        {l.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      </li>
                    ))}
                  </ul>
                  <form action={deleteDocumentAction} className="flex items-center gap-2">
                    <input type="hidden" name="documentId" value={d.id} />
                    <input type="hidden" name="reason" value="管理画面からの削除操作" />
                    <button
                      className="rounded border border-slate-300 px-2.5 py-1.5 text-[11px] text-slate-600"
                      title={
                        d.retentionUntil >= today
                          ? "保存期限内のため削除できません"
                          : "論理削除します"
                      }
                    >
                      削除してみる
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          「削除してみる」を押すと、<b>保存期限内は削除が拒否され、その操作自体が履歴に残ります</b>。
          これが電子帳簿保存法の「真実性の確保」にあたる部分です。
        </p>
      </section>
    </div>
  );
}

const inputCls = "mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm";
