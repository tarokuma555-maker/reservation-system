import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { isServiceableArea } from "@/lib/availability";
import { addDays, formatDateJa, todayStr } from "@/lib/time";
import BookingForm from "@/components/BookingForm";
import { DeliveryBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ menuId: string }> }) {
  const { menuId } = await params;
  const [menu, customer, settings] = await Promise.all([
    prisma.menu.findUnique({ where: { id: menuId } }),
    getCurrentCustomer(),
    getSettings(),
  ]);
  if (!menu || !customer) notFound();

  // 訪問メニューはエリア判定を通す（オンラインは常に通る）
  if (!isServiceableArea(settings, menu.deliveryType as "visit" | "online", customer.address)) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold tracking-tight text-ink">{menu.name}</h1>
        <div className="rounded-xl border border-ocean-500/30 bg-ocean-100 p-4 text-sm leading-relaxed text-ocean-600">
          恐れ入りますが、ご登録のご住所は訪問対応エリア外です。
          <br />
          オンラインの片付けコンサルは全国どこからでもご利用いただけます。
        </div>
      </div>
    );
  }

  // 訪問メニューで住所が未登録なら、この時点で入力してもらう（段階的入力）
  const needsAddress = menu.deliveryType === "visit" && !customer.address;

  const options = await prisma.menuOption.findMany({
    where: { isPublished: true, OR: [{ menuId: null }, { menuId: menu.id }] },
    orderBy: { sortOrder: "asc" },
  });

  const today = todayStr();
  const dates = Array.from({ length: 21 }, (_, i) => addDays(today, i));
  const dateLabels = dates.map((d, i) =>
    i === 0 ? "今日" : i === 1 ? "明日" : formatDateJa(d)
  );

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight text-ink">{menu.name}</h1>
          <DeliveryBadge type={menu.deliveryType} />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{menu.description}</p>
      </div>

      {needsAddress ? (
        <div className="rounded-xl border border-warn-100 bg-warn-50 p-3 text-xs text-warn-700">
          訪問のご予約にはご住所が必要です。デモではお客様を切り替えてお試しください。
        </div>
      ) : (
        <BookingForm
          customerId={customer.id}
          menu={{
            id: menu.id,
            name: menu.name,
            deliveryType: menu.deliveryType,
            durationMinutes: menu.durationMinutes,
            price: menu.price,
          }}
          options={options.map((o) => ({
            id: o.id,
            name: o.name,
            additionalMinutes: o.additionalMinutes,
            additionalPrice: o.additionalPrice,
          }))}
          dates={dates}
          dateLabels={dateLabels}
        />
      )}
    </div>
  );
}
