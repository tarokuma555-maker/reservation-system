import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { calculateTax } from "@/lib/tax";
import { Card, DeliveryBadge, ProvisionalNote, SectionTitle } from "@/components/ui";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function MenusAdminPage() {
  const [menus, options, settings] = await Promise.all([
    prisma.menu.findMany({ orderBy: [{ deliveryType: "asc" }, { sortOrder: "asc" }] }),
    prisma.menuOption.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">メニュー</h1>
        <p className="text-sm text-slate-500">
          料金は税込で登録します（消費者向けは総額表示が義務のため）
        </p>
      </header>

      <ProvisionalNote>
        料金・所要時間はすべて仮置きです。実際のメニュー表が決まり次第、差し替えます。
      </ProvisionalNote>

      <section>
        <SectionTitle hint="提供形態によって、予約フローの分岐がすべて決まります">
          メニュー一覧
        </SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">メニュー</th>
                <th className="px-4 py-2 text-left">形態</th>
                <th className="px-4 py-2 text-right">所要</th>
                <th className="px-4 py-2 text-right">税込</th>
                <th className="px-4 py-2 text-right">税抜</th>
                <th className="px-4 py-2 text-right">消費税</th>
                <th className="px-4 py-2 text-left">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menus.map((m) => {
                const b = calculateTax(
                  [
                    {
                      description: m.name,
                      transactionDate: "2026-01-01",
                      quantity: 1,
                      unitPrice: m.price,
                      taxRate: m.taxRate,
                    },
                  ],
                  settings.roundingMode
                );
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-ink">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.category}</p>
                    </td>
                    <td className="px-4 py-2">
                      <DeliveryBadge type={m.deliveryType} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.durationMinutes}分</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatYen(m.price)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {formatYen(b.subtotalByTaxRate[m.taxRate] ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {formatYen(b.taxByTaxRate[m.taxRate] ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {[
                        m.isRecurringOnly ? "定期専用" : null,
                        m.isFirstTimeOnly ? "初回限定" : null,
                        m.applyLayoutAdjust ? "間取り補正あり" : null,
                        m.isPublished ? null : "非公開",
                      ]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle>オプション</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">オプション</th>
                <th className="px-4 py-2 text-right">追加時間</th>
                <th className="px-4 py-2 text-right">追加料金（税込）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {options.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">{o.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">+{o.additionalMinutes}分</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    +{formatYen(o.additionalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle>間取りによる所要時間の補正</SectionTitle>
        <Card>
          <ul className="space-y-1 text-sm text-slate-700">
            {Object.entries(settings.layoutAdjustMinutes).map(([layout, min]) => (
              <li key={layout} className="flex justify-between">
                <span>{layout}</span>
                <span className="tabular-nums">{min === 0 ? "基本のまま" : `+${min}分`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            訪問メニューにのみ適用します。オンラインには適用されません。
          </p>
        </Card>
      </section>
    </div>
  );
}
