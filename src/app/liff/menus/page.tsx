import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isServiceableArea } from "@/lib/availability";
import { DeliveryBadge } from "@/components/ui";
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
      <h1 className="text-lg font-bold text-ink">メニューを選ぶ</h1>

      <div className="flex gap-2">
        <FilterTab href="/liff/menus" label="すべて" active={!type} />
        <FilterTab href="/liff/menus?type=visit" label="🏠 訪問" active={type === "visit"} />
        <FilterTab href="/liff/menus?type=online" label="💻 オンライン" active={type === "online"} />
      </div>

      {!canVisit ? (
        <div className="rounded-xl border border-clay-500/30 bg-clay-100 p-3 text-xs leading-relaxed text-clay-600">
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
                    blocked ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-ink">{m.name}</h3>
                    <DeliveryBadge type={m.deliveryType} />
                  </div>
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
                        className="rounded-lg bg-sage-600 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        選ぶ
                      </Link>
                    )}
                  </div>
                  {m.isFirstTimeOnly ? (
                    <p className="mt-2 text-[11px] text-clay-600">※ はじめての方限定のプランです</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="pt-2 text-center text-xs text-slate-500">
        定期でのご利用をご希望の方は{" "}
        <Link href="/liff/recurring/new" className="text-sage-600 underline">
          定期利用の申込み
        </Link>{" "}
        へ
      </p>
    </div>
  );
}

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
        active ? "bg-sage-600 text-white" : "border border-slate-300 bg-white text-slate-600"
      }`}
    >
      {label}
    </Link>
  );
}
