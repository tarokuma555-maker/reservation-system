import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { DeliveryBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { formatRange, formatYen, now, toTimeStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function LiffHome() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <p className="p-6 text-sm leading-relaxed text-slate-600">
        お客様の情報を読み込めませんでした。恐れ入りますが、
        LINEのメニューからもう一度お開きください。
      </p>
    );
  }

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

      {/* 住所が無いと訪問のメニューが一切選べない。行き止まりにしないための入口 */}
      {!customer.address ? (
        <Link
          href="/liff/profile"
          className="flex items-start gap-2.5 rounded-2xl border border-warn-100 bg-warn-50 p-4"
        >
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
          <span className="text-xs leading-relaxed text-warn-700">
            <b>ご住所をご登録ください。</b>
            <br />
            ご自宅へうかがうメニューをご予約いただけるようになります。
            オンラインのみをご利用の場合は、そのままで大丈夫です。
          </span>
        </Link>
      ) : null}

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
                  当日はこの画面からビデオ通話に入れます。始まる15分前にも、LINEでお送りします。
                </p>
              ) : null}
            </div>

            <p className="flex items-center gap-1 border-t border-white/20 px-5 py-3 text-2xs font-bold">
              くわしく見る・日にちを変える・お取り消し
              <Icon name="arrowRight" className="h-3 w-3" />
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
        <Tile href="/liff/menus" icon="calendar" title="予約する" sub="メニューから選びます" accent />
        <Tile
          href="/liff/recurring"
          icon="repeat"
          title="定期でのご利用"
          sub={activeRules > 0 ? `${activeRules}件ご利用中` : "毎回の予約が不要になります"}
        />
        <Tile
          href="/liff/reservations"
          icon="calendarCheck"
          title="ご予約の確認"
          sub={doneCount > 0 ? `これまで${doneCount}回ご利用` : "変更・キャンセルもこちら"}
        />
        <Tile href="/liff/invoices" icon="receipt" title="領収書" sub="これまでの領収書" />
      </div>

      <section className="rounded-card border border-slate-200/80 bg-surface p-5 shadow-card">
        <h2 className="text-sm font-bold tracking-tight text-ink">はじめての方へ・ご利用の流れ</h2>
        <ol className="mt-3 space-y-3">
          {[
            { n: "1", t: "メニューを選ぶ", d: "訪問とオンラインから選べます" },
            { n: "2", t: "日時を選ぶ", d: "空いている時間だけが表示されます" },
            { n: "3", t: "おしまい", d: "承りましたのご連絡と、前の日のおしらせが届きます" },
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
          <Row label="2日前まで" value="無料" />
          <Row label="前日" value="料金の50%" />
          <Row label="当日" value="ご相談ください" />
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
  icon,
  title,
  sub,
  accent,
}: {
  href: string;
  icon: IconName;
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
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          accent ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
        }`}
      >
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <p className="mt-2.5 text-sm font-bold tracking-tight text-ink">{title}</p>
      <p className="mt-0.5 text-2xs leading-relaxed text-slate-500">{sub}</p>
    </Link>
  );
}
