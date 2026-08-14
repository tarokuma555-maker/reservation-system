import { prisma } from "@/lib/db";
import { Button, Card, Empty, Field, SectionTitle, inputClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen, todayStr } from "@/lib/time";
import { deleteDocumentAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  issued_invoice: "お客様にお渡しした領収書の控え",
  received_receipt: "受け取ったレシート",
  received_invoice: "受け取った請求書",
};

const ACTION_LABEL: Record<string, string> = {
  create: "保管しました",
  view: "見ました",
  delete_rejected: "削除しようとしましたが、まだ捨てられません",
  delete: "削除しました",
  update: "内容を直しました",
};

/**
 * レシート・書類の保管。
 * 法律（電子帳簿保存法）が求める3つの手がかり — いつ・いくら・どこ — で探せるようにしている。
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; min?: string; max?: string; party?: string }>;
}) {
  const q = await searchParams;
  const filtered = Boolean(q.from || q.to || q.min || q.max || q.party);

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
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">レシートの保管</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          レシートや領収書は、法律で<b>7年間とっておく</b>ことが決まっています。
          紙で箱にためておく代わりに、ここに入れておけば「いつ・いくら・どこの」で探せます。
        </p>
      </header>

      <section>
        <SectionTitle hint="どれか1つだけでも探せます。空けたところは指定なしになります">
          さがす
        </SectionTitle>
        <Card>
          <form className="flex flex-wrap items-end gap-3">
            <Field label="いつ（この日から）">
              <input type="date" name="from" defaultValue={q.from} className={inputClass} />
            </Field>
            <Field label="（この日まで）">
              <input type="date" name="to" defaultValue={q.to} className={inputClass} />
            </Field>
            <Field label="いくら（これ以上）">
              <input
                type="number"
                name="min"
                defaultValue={q.min}
                placeholder="1000"
                className={`${inputClass} w-32`}
              />
            </Field>
            <Field label="（これ以下）">
              <input
                type="number"
                name="max"
                defaultValue={q.max}
                placeholder="50000"
                className={`${inputClass} w-32`}
              />
            </Field>
            <Field label="どこの" hint="一部だけでも見つかります" className="min-w-[180px] flex-1">
              <input
                name="party"
                defaultValue={q.party}
                placeholder="カインズ など"
                className={inputClass}
              />
            </Field>
            <Button type="submit">
              <Icon name="search" className="h-4 w-4" />
              さがす
            </Button>
            {filtered ? (
              <a
                href="/admin/documents"
                className="inline-flex items-center gap-1.5 rounded-pill border border-slate-200 bg-surface px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
                ぜんぶ表示
              </a>
            ) : null}
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle hint={filtered ? `${documents.length}件 見つかりました` : `${documents.length}件`}>
          保管しているもの
        </SectionTitle>
        {documents.length === 0 ? (
          <Empty>
            {filtered
              ? "その条件では見つかりませんでした。条件をゆるめてみてください。"
              : "まだ何も入っていません。"}
          </Empty>
        ) : (
          <div className="space-y-3">
            {documents.map((d) => {
              const locked = d.retentionUntil >= today;
              return (
                <Card key={d.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon name="folder" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{d.counterpartyName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {KIND_LABEL[d.kind] ?? d.kind} ／ {d.transactionDate} のお取引
                        </p>
                        {d.fileHash ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-2xs text-slate-400">
                            <Icon name="check" className="h-3 w-3" />
                            中身が書きかえられていないか、いつでも確かめられます
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-ink">
                        {formatYen(d.transactionAmount)}
                      </p>
                      <p className="mt-0.5 text-2xs text-slate-500">
                        {d.retentionUntil} まで とっておきます
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <ul className="space-y-0.5 text-2xs text-slate-500">
                      {d.logs.map((l) => (
                        <li key={l.id} className="flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
                          {ACTION_LABEL[l.action] ?? l.action}
                          {l.detail ? `（${l.detail}）` : ""} ／{" "}
                          {l.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                        </li>
                      ))}
                    </ul>
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="documentId" value={d.id} />
                      <input type="hidden" name="reason" value="管理画面からの削除操作" />
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        title={
                          locked
                            ? "まだ7年たっていないので、押しても捨てられません"
                            : "保存の期限が過ぎているので捨てられます"
                        }
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        捨ててみる
                      </Button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex gap-3 rounded-card border border-slate-200/80 bg-surface px-4 py-3.5">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-xs leading-relaxed text-slate-600">
            「捨ててみる」を押しても、<b>7年たっていないものは捨てられません</b>。
            そして「捨てようとした」ことまで記録に残ります。
            うっかり消してしまう事故を防ぎ、あとから見た人が経緯をたどれるようにするための仕組みです。
          </p>
        </div>
      </section>
    </div>
  );
}
