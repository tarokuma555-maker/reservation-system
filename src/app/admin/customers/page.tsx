import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      reservations: { include: { menu: true }, orderBy: { startAt: "desc" } },
      recurringRules: { where: { status: "active" } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">お客様</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          いま {customers.length}名 のお客様がLINEでつながっています。
          お名前・ご住所・これまでのご利用が一目で分かります。
        </p>
      </header>

      <div className="space-y-4">
        {customers.map((c) => {
          const done = c.reservations.filter((r) => r.status === "completed");
          const total = done.reduce((s, r) => s + r.totalPrice, 0);
          const tags = c.tags.split(",").filter(Boolean);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name="user" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {c.companyName ? `${c.companyName} ／ ` : ""}
                      {c.name} 様
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <Icon name="phone" className="h-3.5 w-3.5 text-slate-400" />
                      {c.phone}
                      {c.email ? ` ／ ${c.email}` : ""}
                    </p>
                    <p className="mt-0.5 inline-flex items-start gap-1.5 text-xs text-slate-600">
                      <Icon name="pin" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {c.address ? (
                        <span>
                          {c.address} {c.buildingName ?? ""}
                          {c.layout ? `（${c.layout}）` : ""}
                        </span>
                      ) : (
                        <span className="text-ocean-700">
                          ご住所の登録なし（オンラインのみご利用のお客様）
                        </span>
                      )}
                    </p>
                    {c.registrationNumber ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        登録番号 {c.registrationNumber}（領収書の宛名が会社名になります）
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-pill bg-slate-100 px-2.5 py-0.5 text-2xs font-medium text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                      {c.recurringRules.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-brand-100 px-2.5 py-0.5 text-2xs font-bold text-brand-700">
                          <Icon name="repeat" className="h-3 w-3" />
                          定期のお客様
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-2xs text-slate-500">これまでのご利用</p>
                  <p className="text-lg font-extrabold tabular-nums tracking-tighter text-ink">
                    {formatYen(total)}
                  </p>
                  <p className="text-2xs text-slate-500">{done.length}回 ぶん（税こみ）</p>
                </div>
              </div>

              {c.reservations.length > 0 ? (
                <div className="mt-3.5 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-2xs font-bold tracking-wide text-slate-500">
                    さいきんのご予約
                  </p>
                  <ul className="space-y-1.5">
                    {c.reservations.slice(0, 3).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="truncate text-slate-600 transition hover:text-brand-700 hover:underline"
                        >
                          {r.startAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}{" "}
                          {r.menu.name}
                        </Link>
                        <DeliveryBadge type={r.deliveryType} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <section>
        <SectionTitle>これから足せること</SectionTitle>
        <Card className="text-sm leading-relaxed text-slate-600">
          いまは一覧とご利用の履歴までです。ご要望があれば、
          <b>お客様ごとのメモ（作業の記録・お写真・次回への申し送り）</b>や、
          お客様への個別のLINEメッセージも足せます。ご希望をお聞かせください。
        </Card>
      </section>
    </div>
  );
}
