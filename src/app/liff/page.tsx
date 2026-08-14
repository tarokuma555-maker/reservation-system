import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge } from "@/components/ui";
import { formatRange, formatYen, now } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function LiffHome() {
  const customer = await getCurrentCustomer();
  if (!customer) return <p className="p-6 text-sm">デモデータがありません。</p>;

  const next = await prisma.reservation.findFirst({
    where: { customerId: customer.id, status: "confirmed", startAt: { gte: now() } },
    orderBy: { startAt: "asc" },
    include: { menu: true },
  });

  const activeRules = await prisma.recurringRule.count({
    where: { customerId: customer.id, status: { in: ["active", "paused"] } },
  });

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-sage-50 p-4">
        <p className="text-sm text-slate-700">
          {customer.name} 様、こんにちは。
          <br />
          ご予約・変更・キャンセルは、この画面からいつでも承ります。
        </p>
      </div>

      {next ? (
        <Link href={`/liff/reservations/${next.id}`} className="block">
          <div className="rounded-2xl border border-sage-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-sage-600">次回のご予約</p>
              <DeliveryBadge type={next.deliveryType} />
            </div>
            <p className="mt-1 font-bold text-ink">{formatRange(next.startAt, next.endAt)}</p>
            <p className="text-sm text-slate-600">{next.menu.name}</p>
            <p className="mt-1 text-sm text-slate-500">{formatYen(next.totalPrice)}（税込）</p>
            {next.deliveryType === "online" && next.meetingUrl ? (
              <p className="mt-2 rounded-lg bg-clay-100 px-3 py-2 text-xs text-clay-600">
                当日はこちらのURLからご参加ください
              </p>
            ) : null}
            <p className="mt-2 text-xs text-sage-600">詳細・変更はこちら →</p>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center">
          <p className="text-sm text-slate-500">現在ご予約はありません</p>
          <Link
            href="/liff/menus"
            className="mt-3 inline-block rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white"
          >
            予約する
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/liff/menus" icon="📅" title="予約する" sub="メニューから選ぶ" />
        <Tile
          href="/liff/recurring"
          icon="🔁"
          title="定期利用"
          sub={activeRules > 0 ? `${activeRules}件ご利用中` : "はじめる"}
        />
        <Tile href="/liff/reservations" icon="✅" title="予約の確認" sub="変更・キャンセル" />
        <Tile href="/liff/invoices" icon="🧾" title="領収書" sub="発行済みの書類" />
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <p className="font-bold text-slate-700">キャンセルについて</p>
        <p className="mt-1">
          48時間前まではこの画面からキャンセルできます。24〜48時間前はキャンセル料50%、
          24時間前を過ぎるとこの画面からの操作はできませんので、お問い合わせください。
        </p>
      </div>
    </div>
  );
}

function Tile({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-sage-400"
    >
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 text-sm font-bold text-ink">{title}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </Link>
  );
}
