import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isServiceableArea } from "@/lib/availability";
import { DeliveryBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { formatYen } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const [customer, settings, menus] = await Promise.all([
    getCurrentCustomer(),
    getSettings(),
    prisma.menu.findMany({
      where: { isPublished: true, isRecurringOnly: false },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);
  if (!customer) return null;

  const pastCount = await prisma.reservation.count({
    where: { customerId: customer.id, status: { in: ["completed", "confirmed"] } },
  });
  const isFirstTime = pastCount === 0;

  const canVisit = isServiceableArea(settings, "visit", customer.address);

  const filtered = menus
    .filter((m) => (type ? m.deliveryType === type : true))
    .filter((m) => (m.isFirstTimeOnly ? isFirstTime : true));

  const byCategory = filtered.reduce<Record<string, typeof filtered>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold tracking-tight text-ink">メニューを選ぶ</h1>

      <div className="flex gap-2">
        <FilterTab href="/liff/menus" label="すべて" active={!type} />
        <FilterTab href="/liff/menus?type=visit" label="ご自宅へ訪問" icon="visit" active={type === "visit"} />
        <FilterTab href="/liff/menus?type=online" label="オンライン" icon="online" active={type === "online"} />
      </div>

      {!canVisit ? (
        <div className="rounded-xl border border-ocean-500/30 bg-ocean-100 p-3 text-xs leading-relaxed text-ocean-600">
          <b>ご登録のご住所は訪問エリア外です。</b>
          <br />
          対応エリア: {settings.serviceAreas.join("・")}
          <br />
          オンラインでの片付けコンサルは<b>全国どこからでもご利用いただけます</b>ので、ぜひご検討ください。
        </div>
      ) : null}

      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-2 text-sm font-bold text-slate-600">{category}</h2>
          <div className="space-y-3">
            {items.map((m) => {
              const blocked = m.deliveryType === "visit" && !canVisit;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    blocked ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-surface"
                  }`}
                >
                  <DeliveryBadge type={m.deliveryType} />
                  <h3 className="mt-2 font-bold leading-snug tracking-tight text-ink">{m.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{m.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      約{m.durationMinutes}分 ／{" "}
                      <span className="font-bold text-ink">{formatYen(m.price)}</span>
                      <span className="text-xs text-slate-500">（税込）</span>
                    </p>
                    {blocked ? (
                      <span className="text-xs text-slate-500">エリア外</span>
                    ) : (
                      <Link
                        href={`/liff/book/${m.id}`}
                        className="rounded-pill bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-card transition hover:bg-brand-700"
                      >
                        選ぶ
                      </Link>
                    )}
                  </div>
                  {m.isFirstTimeOnly ? (
                    <p className="mt-2 text-2xs text-ocean-600">※ はじめての方限定のプランです</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="pt-2 text-center text-xs text-slate-500">
        定期でのご利用をご希望の方は{" "}
        <Link href="/liff/recurring/new" className="text-brand-600 underline">
          定期利用の申込み
        </Link>{" "}
        へ
      </p>
    </div>
  );
}

function FilterTab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon?: IconName;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-xs font-bold transition ${
        active
          ? "bg-brand-600 text-white"
          : "border border-slate-200 bg-surface text-slate-600 hover:border-brand-300"
      }`}
    >
      {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : null}
      {label}
    </Link>
  );
}
