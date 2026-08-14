import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseBreakdown } from "@/lib/invoice";
import { Card, Empty, ProvisionalNote, SectionTitle } from "@/components/ui";
import InvoiceIssueForm from "@/components/InvoiceIssueForm";
import { formatYen, toDateStr } from "@/lib/time";
import { voidInvoiceAction, issueReturnedInvoiceAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "適格返還請求書",
  corrected: "修正インボイス",
};

export default async function InvoicesPage() {
  const settings = await getSettings();

  const [invoices, customers] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { invoiceNumber: "desc" },
      include: { customer: true, lines: true },
    }),
    prisma.customer.findMany({
      include: {
        reservations: {
          where: { status: "completed", invoiceLines: { none: {} } },
          include: { menu: true },
          orderBy: { startAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const candidates = customers.map((c) => ({
    id: c.id,
    name: c.companyName ? `${c.companyName}（${c.name} 様）` : `${c.name} 様`,
    candidates: c.reservations.map((r) => ({
      id: r.id,
      label: r.menu.name,
      amount: r.totalPrice,
      date: toDateStr(r.startAt),
    })),
  }));

  const registrationOk = /^T\d{13}$/.test(settings.registrationNumber);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">請求書・領収書</h1>
        <p className="text-sm text-slate-500">
          適格請求書（インボイス）の発行と一覧。発行時に法定6項目を検証します。
        </p>
      </header>

      {!registrationOk ? (
        <div className="rounded-lg border border-bad-100 bg-bad-50 px-4 py-3 text-sm text-bad-700">
          登録番号が「T + 数字13桁」の形式ではないため、インボイスを発行できません。
          <Link href="/admin/settings" className="ml-1 underline">
            設定
          </Link>
          で登録番号を入力してください。
        </div>
      ) : (
        <ProvisionalNote>
          発行事業者「{settings.issuerName}」／ 登録番号「{settings.registrationNumber}」は<b>仮の値</b>
          です。実際の登録番号に差し替えると、以降に発行する書類に反映されます（
          <b>発行済みの書類は発行時点の値のまま変わりません</b>）。
        </ProvisionalNote>
      )}

      <section>
        <SectionTitle hint="実施済みかつ未発行の予約が対象です">新しく発行する</SectionTitle>
        <Card>
          <InvoiceIssueForm customers={candidates} />
        </Card>
      </section>

      <section>
        <SectionTitle>発行済みの書類</SectionTitle>
        {invoices.length === 0 ? (
          <Empty>まだ発行していません</Empty>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const tax = parseBreakdown(inv.taxByTaxRate);
              const sub = parseBreakdown(inv.subtotalByTaxRate);
              return (
                <Card key={inv.id} className={inv.status === "void" ? "opacity-60" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">
                        {inv.invoiceNumber}
                        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-2xs font-normal text-slate-600">
                          {TYPE_LABEL[inv.type] ?? inv.type}
                        </span>
                        {inv.status === "void" ? (
                          <span className="ml-2 rounded bg-bad-100 px-2 py-0.5 text-2xs text-bad-600">
                            無効
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {inv.issueDate} ／ {inv.recipientName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {Object.keys(tax).map((rate) => (
                          <span key={rate} className="mr-3">
                            {rate}%対象 {formatYen(sub[rate] ?? 0)}（消費税 {formatYen(tax[rate] ?? 0)}）
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums">{formatYen(inv.totalAmount)}</p>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-xs text-brand-600 underline"
                      >
                        PDFを表示
                      </Link>
                    </div>
                  </div>

                  {inv.status !== "void" && inv.type !== "returned" ? (
                    <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3">
                      <form action={voidInvoiceAction} className="flex items-end gap-2">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input
                          name="reason"
                          placeholder="無効にする理由"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-2xs"
                        />
                        <button className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300">
                          無効にする
                        </button>
                      </form>

                      <form action={issueReturnedInvoiceAction} className="flex items-end gap-2">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input
                          type="number"
                          name="amount"
                          defaultValue={Math.floor(inv.totalAmount / 2)}
                          className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-2xs tabular-nums"
                        />
                        <input
                          name="description"
                          defaultValue="キャンセル料の返還"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-2xs"
                        />
                        <button className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-slate-600 transition hover:border-brand-300">
                          返還インボイスを発行
                        </button>
                      </form>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>この画面の実装状況</SectionTitle>
        <Card className="space-y-2 text-sm leading-relaxed text-slate-600">
          <p>
            <b>できていること</b>: 適格請求書の発行（法定6項目の検証つき）、税率ごとに1回だけの1円未満の扱い、
            発行時点の登録番号・宛名のスナップショット保存、無効化（欠番を作らない）、適格返還請求書の発行、
            連番の採番。
          </p>
          <p>
            <b>本実装で追加するもの</b>: PDFファイルの生成とLINEへの実送信、レシートの読み取りによる経費登録、
            電子帳簿保存法に対応したレシート・書類の保存と検索、仕訳の自動生成、決算書の出力。
          </p>
        </Card>
      </section>
    </div>
  );
}
