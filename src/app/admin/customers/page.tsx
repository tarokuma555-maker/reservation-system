import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, DeliveryBadge, SectionTitle } from "@/components/ui";
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
        <h1 className="text-xl font-bold text-ink">顧客</h1>
        <p className="text-sm text-slate-500">{customers.length}名</p>
      </header>

      <div className="space-y-4">
        {customers.map((c) => {
          const done = c.reservations.filter((r) => r.status === "completed");
          const total = done.reduce((s, r) => s + r.totalPrice, 0);
          const tags = c.tags.split(",").filter(Boolean);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {c.companyName ? `${c.companyName} ／ ` : ""}
                    {c.name} 様
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.phone}
                    {c.email ? ` ／ ${c.email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {c.address ? (
                      <>
                        {c.address} {c.buildingName ?? ""}
                        {c.layout ? `（${c.layout}）` : ""}
                      </>
                    ) : (
                      <span className="text-clay-600">
                        住所の登録なし（オンラインのみのお客様）
                      </span>
                    )}
                  </p>
                  {c.registrationNumber ? (
                    <p className="mt-1 text-xs text-slate-500">
                      登録番号 {c.registrationNumber}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                    {c.recurringRules.length > 0 ? (
                      <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] text-sage-700">
                        定期 {c.recurringRules.length}件
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 text-right text-xs text-slate-500">
                  <p>利用 {done.length} 回</p>
                  <p className="text-sm font-bold text-ink">{formatYen(total)}</p>
                  <p>累計（税込）</p>
                </div>
              </div>

              {c.reservations.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-bold text-slate-600">直近の予約</p>
                  <ul className="space-y-1">
                    {c.reservations.slice(0, 3).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="truncate text-slate-600 hover:underline"
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
        <SectionTitle>この画面の位置づけ</SectionTitle>
        <Card className="text-sm leading-relaxed text-slate-600">
          デモでは一覧と履歴の表示までです。要件定義に含まれる
          <b>カルテ（作業記録・写真・申し送り）</b>、タグの編集、
          LINEからの個別メッセージ送信は本実装で追加します。
        </Card>
      </section>
    </div>
  );
}
