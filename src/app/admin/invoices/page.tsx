import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseBreakdown } from "@/lib/invoice";
import { Button, Card, Empty, ProvisionalNote, SectionTitle, inputClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import InvoiceIssueForm from "@/components/InvoiceIssueForm";
import { formatYen, toDateStr } from "@/lib/time";
import { voidInvoiceAction, issueReturnedInvoiceAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  receipt: "領収書",
  invoice: "請求書",
  returned: "返金の書類",
  corrected: "書き直した書類",
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

  const waiting = candidates.reduce((s, c) => s + c.candidates.length, 0);
  const registrationOk = /^T\d{13}$/.test(settings.registrationNumber);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">領収書を出す</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          終わったお仕事をえらぶだけで、消費税の内訳まで入った領収書ができあがります。
          そのままLINEでお送りできます。
        </p>
      </header>

      {!registrationOk ? (
        <div className="flex gap-3 rounded-card border border-bad-100 bg-bad-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
          <p className="text-sm leading-relaxed text-bad-700">
            登録番号がまだ正しく入っていないので、領収書を出せません。
            「T」ではじまる14文字（Tのあとに数字13けた）を、
            <Link href="/admin/settings" className="mx-1 font-bold underline">
              お店の設定
            </Link>
            に入れてください。
          </p>
        </div>
      ) : (
        <ProvisionalNote>
          いまは お店の名前「{settings.issuerName}」／ 登録番号「{settings.registrationNumber}」
          という<b>仮の値</b>が入っています。本物に入れ替えると、これから出す書類に反映されます。
          <b>すでに出した書類は、出したときのままで変わりません</b>（あとから中身が変わらないようにするためです）。
        </ProvisionalNote>
      )}

      <section>
        <SectionTitle
          hint={
            waiting > 0
              ? `いま ${waiting}件 のお仕事が、まだ領収書を出していません`
              : "終わったお仕事がすべて発行ずみです"
          }
        >
          あたらしく出す
        </SectionTitle>
        <Card>
          <InvoiceIssueForm customers={candidates} />
        </Card>
      </section>

      <section>
        <SectionTitle hint="押すとPDFで開けます。印刷もできます">これまでに出した書類</SectionTitle>
        {invoices.length === 0 ? (
          <Empty>まだ1枚も出していません。上の「あたらしく出す」からどうぞ。</Empty>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const tax = parseBreakdown(inv.taxByTaxRate);
              const sub = parseBreakdown(inv.subtotalByTaxRate);
              const isVoid = inv.status === "void";
              return (
                <Card key={inv.id} className={isVoid ? "opacity-60" : ""}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon name="receipt" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                          {inv.recipientName}
                          <span className="rounded-pill bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-600">
                            {TYPE_LABEL[inv.type] ?? inv.type}
                          </span>
                          {isVoid ? (
                            <span className="rounded-pill bg-bad-100 px-2 py-0.5 text-2xs font-bold text-bad-700">
                              取り消しずみ
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {inv.issueDate} に発行 ／ 番号 {inv.invoiceNumber}
                        </p>
                        <p className="mt-1 text-2xs text-slate-500">
                          {Object.keys(tax).map((rate) => (
                            <span key={rate} className="mr-3">
                              {rate}%のぶん {formatYen(sub[rate] ?? 0)}（うち消費税{" "}
                              {formatYen(tax[rate] ?? 0)}）
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold tabular-nums tracking-tighter text-ink">
                        {formatYen(inv.totalAmount)}
                      </p>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="mt-1 inline-flex items-center gap-1 rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-2xs font-bold text-brand-700 transition hover:border-brand-300"
                      >
                        <Icon name="search" className="h-3.5 w-3.5" />
                        中身を見る
                      </Link>
                    </div>
                  </div>

                  {!isVoid && inv.type !== "returned" ? (
                    <details className="group mt-3 border-t border-slate-100 pt-3">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs font-bold text-slate-500 transition hover:text-brand-700">
                        <Icon
                          name="chevronRight"
                          className="h-3 w-3 transition group-open:rotate-90"
                        />
                        まちがえた・返金したときはこちら
                      </summary>

                      <div className="mt-3 space-y-4">
                        <form action={voidInvoiceAction} className="space-y-1.5">
                          <p className="text-2xs font-bold text-slate-600">
                            この書類を取り消す
                            <span className="ml-1 font-normal text-slate-500">
                              （消さずに「取り消しずみ」として残ります。番号が抜けないようにするためです）
                            </span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input
                              name="reason"
                              placeholder="なぜ取り消すか（例: 金額をまちがえたため）"
                              className={`${inputClass} max-w-sm flex-1 py-2 text-xs`}
                            />
                            <Button type="submit" variant="danger" size="sm">
                              <Icon name="close" className="h-3.5 w-3.5" />
                              取り消す
                            </Button>
                          </div>
                        </form>

                        <form action={issueReturnedInvoiceAction} className="space-y-1.5">
                          <p className="text-2xs font-bold text-slate-600">
                            一部を返金する
                            <span className="ml-1 font-normal text-slate-500">
                              （返金の書類をあらためて出します）
                            </span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input
                              type="number"
                              name="amount"
                              defaultValue={Math.floor(inv.totalAmount / 2)}
                              className={`${inputClass} !w-32 py-2 text-xs tabular-nums`}
                            />
                            <input
                              name="description"
                              defaultValue="キャンセル料の返還"
                              className={`${inputClass} max-w-xs flex-1 py-2 text-xs`}
                            />
                            <Button type="submit" variant="secondary" size="sm">
                              返金の書類を出す
                            </Button>
                          </div>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>この画面がやっていること</SectionTitle>
        <Card className="space-y-3 text-sm leading-relaxed text-slate-600">
          <Point icon="check">
            消費税は<b>税率ごとに1回だけ</b>1円未満を処理しています。1件ずつ端数処理すると
            税務署の求める計算とずれてしまうため、あえてこの順番にしています。
          </Point>
          <Point icon="check">
            お店の名前と登録番号は、<b>発行したその時点の内容を書類の中に写して保存</b>しています。
            あとから設定を変えても、昔の書類の中身は変わりません。
          </Point>
          <Point icon="check">
            まちがえた書類は<b>消さずに「取り消しずみ」</b>にします。番号が飛ばないので、
            税理士さんに見てもらうときも説明しやすくなります。
          </Point>
        </Card>
      </section>
    </div>
  );
}

function Point({ icon, children }: { icon: "check"; children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5">
      <Icon name={icon} className="mt-1 h-3.5 w-3.5 shrink-0 text-good-600" strokeWidth={2.4} />
      <span>{children}</span>
    </p>
  );
}
