import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { calculateTax } from "@/lib/tax";
import { Card, DeliveryBadge, ProvisionalNote, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
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
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">メニューと料金</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          お客様のLINEに出るメニューです。料金は<b>税こみの金額</b>で入れてください。
          お客様に見せる値段は税こみで書くことが法律で決まっているためです。
        </p>
      </header>

      <ProvisionalNote>
        いまの料金と時間は、ぜんぶ仮の数字です。実際のメニュー表をお送りいただければ、そのまま入れ替えます。
      </ProvisionalNote>

      <section>
        <SectionTitle hint="うかがう形かオンラインかで、お客様の予約の進み方が変わります">
          メニュー
        </SectionTitle>
        <Card className="scroll-x p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">メニュー</th>
                <th className="px-4 py-2.5 text-left">ご利用方法</th>
                <th className="px-4 py-2.5 text-right">かかる時間</th>
                <th className="px-4 py-2.5 text-right">いただく金額</th>
                <th className="px-4 py-2.5 text-right">うち消費税</th>
                <th className="px-4 py-2.5 text-left">そのほか</th>
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
                const notes = [
                  m.isRecurringOnly ? "定期のお客様だけ" : null,
                  m.isFirstTimeOnly ? "はじめての方だけ" : null,
                  m.applyLayoutAdjust ? "広さで時間が変わります" : null,
                  m.isPublished ? null : "いまは出していません",
                ].filter(Boolean);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-ink">{m.name}</p>
                      <p className="text-2xs text-slate-500">{m.category}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <DeliveryBadge type={m.deliveryType} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.durationMinutes}分</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                      {formatYen(m.price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {formatYen(b.taxByTaxRate[m.taxRate] ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-2xs text-slate-500">
                      {notes.length ? notes.join(" ／ ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle hint="お客様が予約するときに、追加でえらべるものです">
          追加でえらべるもの
        </SectionTitle>
        <Card className="scroll-x p-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-slate-200 bg-brand-50/60 text-2xs font-bold tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">内容</th>
                <th className="px-4 py-2.5 text-right">増える時間</th>
                <th className="px-4 py-2.5 text-right">増える金額（税こみ）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {options.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5">{o.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">+{o.additionalMinutes}分</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    +{formatYen(o.additionalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle hint="お客様の登録内容から自動で判断します">
          お部屋の広さで、かかる時間を足す
        </SectionTitle>
        <Card>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {Object.entries(settings.layoutAdjustMinutes).map(([layout, min]) => (
              <li key={layout} className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>{layout} のお宅</span>
                <span className="font-medium tabular-nums">
                  {min === 0 ? "そのまま" : `+${min}分`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            おうちにうかがうメニューだけに使います。オンラインには関係ありません。
            広いお宅で時間が足りなくなる、ということを防ぐための仕組みです。
          </p>
        </Card>
      </section>
    </div>
  );
}
