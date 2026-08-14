import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge } from "@/components/ui";
import { formatRange, formatYen, now, toTimeStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function LiffHome() {
  const customer = await getCurrentCustomer();
  if (!customer) return <p className="p-6 text-sm">デモデータがありません。</p>;

  const [next, activeRules, doneCount] = await Promise.all([
    prisma.reservation.findFirst({
      where: { customerId: customer.id, status: "confirmed", startAt: { gte: now() } },
      orderBy: { startAt: "asc" },
      include: { menu: true },
    }),
    prisma.recurringRule.count({
      where: { customerId: customer.id, status: { in: ["active", "paused"] } },
    }),
    prisma.reservation.count({ where: { customerId: customer.id, status: "completed" } }),
  ]);

  return (
    <div className="space-y-5 p-4 pb-8">
      <div className="px-1">
        <p className="text-2xs font-bold tracking-wide text-brand-600">
          {customer.companyName ?? `${customer.name} 様`}
        </p>
        <h1 className="mt-1 text-lg font-bold leading-snug tracking-tight text-ink">
          こんにちは。
          <br />
          ご予約はこの画面から承ります。
        </h1>
      </div>

      {next ? (
        <Link href={`/liff/reservations/${next.id}`} className="block">
          <article className="overflow-hidden rounded-card bg-brand-sheen text-white shadow-lift">
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-2xs font-bold tracking-wide text-white/85">次回のご予約</p>
              <span className="rounded-pill bg-white/25 px-2.5 py-1 text-2xs font-bold">
                {next.deliveryType === "visit" ? "訪問" : "オンライン"}
              </span>
            </div>

            <div className="px-5 pb-5 pt-2">
              <p className="text-2xl font-extrabold tracking-tighter tabular-nums">
                {toTimeStr(next.startAt)}
                <span className="ml-2 align-middle text-sm font-bold tracking-normal">
                  {formatRange(next.startAt, next.endAt).replace(/\s.*$/, "")}
                </span>
              </p>
              <p className="mt-1 text-sm font-medium text-white/90">{next.menu.name}</p>
              <p className="mt-0.5 text-xs text-white/80">
                {formatYen(next.totalPrice)}（税込）・約{next.totalMinutes}分
              </p>

              {next.deliveryType === "online" && next.meetingUrl ? (
                <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-2xs leading-relaxed">
                  当日はこの画面から参加URLを開けます。開始15分前にもお送りします。
                </p>
              ) : null}
            </div>

            <p className="border-t border-white/20 px-5 py-3 text-2xs font-bold">
              詳細・変更・キャンセルはこちら →
            </p>
          </article>
        </Link>
      ) : (
        <article className="rounded-card border border-dashed border-brand-200 bg-brand-50/60 px-5 py-8 text-center">
          <p className="text-sm text-slate-600">いまご予約はありません</p>
          <Link
            href="/liff/menus"
            className="mt-4 inline-flex rounded-pill bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-card"
          >
            予約する
          </Link>
        </article>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile
          href="/liff/menus"
          title="予約する"
          sub="メニューから選ぶ"
          accent
        />
        <Tile
          href="/liff/recurring"
          title="定期利用"
          sub={activeRules > 0 ? `${activeRules}件ご利用中` : "はじめる"}
        />
        <Tile href="/liff/reservations" title="予約の確認" sub={`これまで${doneCount}回`} />
        <Tile href="/liff/invoices" title="領収書" sub="発行済みの書類" />
      </div>

      <section className="rounded-card border border-slate-200/80 bg-surface p-5 shadow-card">
        <h2 className="text-sm font-bold tracking-tight text-ink">ご利用の流れ</h2>
        <ol className="mt-3 space-y-3">
          {[
            { n: "1", t: "メニューを選ぶ", d: "訪問とオンラインから選べます" },
            { n: "2", t: "日時を選ぶ", d: "空いている時間だけが表示されます" },
            { n: "3", t: "確定", d: "確定のご連絡と前日リマインドをお送りします" },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-bold text-brand-700">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{s.t}</span>
                <span className="block text-xs text-slate-500">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-card bg-slate-100/70 px-5 py-4">
        <h2 className="text-2xs font-bold tracking-wide text-slate-600">キャンセルについて</h2>
        <dl className="mt-2 space-y-1.5 text-xs">
          <Row label="48時間前まで" value="無料" />
          <Row label="24〜48時間前" value="50%" />
          <Row label="24時間前以降" value="お問い合わせください" />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-700">{value}</dd>
    </div>
  );
}

function Tile({
  href,
  title,
  sub,
  accent,
}: {
  href: string;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-card border p-4 shadow-card transition hover:-translate-y-0.5 ${
        accent
          ? "border-brand-200 bg-brand-50"
          : "border-slate-200/80 bg-surface hover:border-brand-200"
      }`}
    >
      <p className="text-sm font-bold tracking-tight text-ink">{title}</p>
      <p className="mt-0.5 text-2xs text-slate-500">{sub}</p>
      <p className="mt-3 text-2xs font-bold text-brand-600">開く →</p>
    </Link>
  );
}
