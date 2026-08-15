import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { calculateTax } from "@/lib/tax";
import { Card, DeliveryBadge, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatYen } from "@/lib/time";
import AddMenuPanel from "@/components/AddMenuPanel";
import MenuRowActions from "@/components/MenuRowActions";
import OptionEditor, { AddOptionPanel } from "@/components/OptionEditor";

export const dynamic = "force-dynamic";

export default async function MenusAdminPage() {
  const [menus, options, settings] = await Promise.all([
    prisma.menu.findMany({ orderBy: [{ deliveryType: "asc" }, { sortOrder: "asc" }] }),
    prisma.menuOption.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);

  const categories = [...new Set(menus.map((m) => m.category))].filter(Boolean);

  // 使われているメニューは消さずに隠す。どちらになるかを押す前に伝える。
  const usedCounts = await prisma.reservation.groupBy({
    by: ["menuId"],
    _count: { _all: true },
  });
  const usedByMenu = new Map(usedCounts.map((u) => [u.menuId, u._count._all]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">メニューと料金</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          お客様のLINEに出るメニューです。料金は<b>税こみの金額</b>で入れてください。
          お客様に見せる値段は税こみで書くことが法律で決まっているためです。
        </p>
      </header>

      {menus.length === 0 ? (
        <div className="flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
          <p className="text-xs leading-relaxed text-warn-700">
            <b>メニューが1件もありません。</b>
            <br />
            この状態だと、お客様が「予約する」を押しても選ぶものがありません。
            下の「メニューを新しく追加する」から、1件目を登録してください。
          </p>
        </div>
      ) : null}

      <AddMenuPanel categories={categories} />

      <section>
        <SectionTitle hint="うかがう形かオンラインかで、お客様の予約の進み方が変わります">
          メニュー
        </SectionTitle>

        <div className="space-y-3">
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
            ].filter(Boolean);
            const used = usedByMenu.get(m.id) ?? 0;

            return (
              <Card key={m.id} className={m.isPublished ? "" : "bg-slate-50/70"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{m.name}</p>
                      <DeliveryBadge type={m.deliveryType} />
                      {!m.isPublished ? (
                        <span className="rounded-pill bg-slate-200 px-2.5 py-0.5 text-2xs font-bold text-slate-600">
                          出していません
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-2xs text-slate-500">{m.category}</p>
                    {m.description ? (
                      <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-600">
                        {m.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-ink">{formatYen(m.price)}</p>
                    <p className="text-2xs tabular-nums text-slate-500">
                      うち消費税 {formatYen(b.taxByTaxRate[m.taxRate] ?? 0)}
                    </p>
                    <p className="text-2xs tabular-nums text-slate-500">{m.durationMinutes}分</p>
                  </div>
                </div>

                {notes.length ? (
                  <p className="mt-2 text-2xs text-slate-500">{notes.join(" ／ ")}</p>
                ) : null}

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <MenuRowActions
                    categories={categories}
                    usedCount={used}
                    values={{
                      id: m.id,
                      name: m.name,
                      category: m.category,
                      description: m.description,
                      deliveryType: m.deliveryType,
                      durationMinutes: m.durationMinutes,
                      price: m.price,
                      sortOrder: m.sortOrder,
                      isPublished: m.isPublished,
                      isRecurringOnly: m.isRecurringOnly,
                      isFirstTimeOnly: m.isFirstTimeOnly,
                      applyLayoutAdjust: m.applyLayoutAdjust,
                    }}
                  />
                </div>

                {used > 0 ? (
                  <p className="mt-2 text-2xs leading-relaxed text-slate-500">
                    このメニューは、これまでのご予約{used}件で使われています。
                    消しても記録は残す必要があるため、「出すのをやめる」に切り替わります。
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle hint="お客様が予約するときに、追加でえらべるものです">
          追加でえらべるもの
        </SectionTitle>

        <div className="space-y-3">
          {options.map((o) => (
            <Card key={o.id}>
              <OptionEditor
                values={{
                  id: o.id,
                  name: o.name,
                  additionalMinutes: o.additionalMinutes,
                  additionalPrice: o.additionalPrice,
                }}
              />
            </Card>
          ))}
          {options.length === 0 ? (
            <p className="rounded-card border border-slate-200 bg-surface px-4 py-5 text-center text-xs text-slate-500">
              まだ登録がありません。無くてもご予約は受けられます。
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          <AddOptionPanel />
        </div>
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
            上の「メニューを直す」で、メニューごとに使うかどうかを切り替えられます。
          </p>
        </Card>
      </section>
    </div>
  );
}
