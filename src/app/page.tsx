import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { lineMode } from "@/lib/line";
import { googleMode } from "@/lib/google-calendar";
import { ocrMode } from "@/lib/ocr";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [line, google, ocr] = await Promise.all([lineMode(), googleMode(), ocrMode()]);

  const [settings, customers, menus, reservations, rules, invoices, entries] = await Promise.all([
    getSettings(),
    prisma.customer.count(),
    prisma.menu.count(),
    prisma.reservation.count(),
    prisma.recurringRule.count(),
    prisma.invoice.count(),
    prisma.journalEntry.count(),
  ]);

  return (
    <main className="min-h-screen bg-ground-warm">
      <div className="mx-auto max-w-5xl px-6 py-14 lg:py-20">
        <header className="max-w-2xl">
          <p className="text-2xs font-bold tracking-[0.2em] text-brand-600">DEMO</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-[1.25] tracking-tighter text-ink lg:text-4xl">
            おそうじと片付けの仕事を、
            <br />
            <span className="text-brand-600">LINEひとつ</span>で回す。
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            家事代行・片付けコンサル向けの予約システムです。
            お客様側のLINE画面と、オーナー側の管理画面の両方を、実際に触って動かせます。
            ご予約の受付から、領収書、経費、決算書の用意まで。見せかけではなく、ぜんぶ実際に動きます。
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <EntryCard
            href="/liff"
            eyebrow="お客様側"
            title="LINEの画面"
            body="LINEの下に出るメニューから、ご予約・変更・お取り消し・いつものご予約のお申し込みまで。お客様に届くお知らせも、そのままの見た目で確認できます。"
            accent
          />
          <EntryCard
            href="/admin"
            eyebrow="オーナー側"
            title="管理画面"
            body="予定表、定期のお客様、領収書、レシートの読み取りと保管、そして決算書まで。今日やることが最初に出ます。"
          />
        </div>

        <section className="mt-14">
          <h2 className="text-sm font-bold tracking-tight text-ink">とくに見ていただきたい4つ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Point
              n="01"
              title="うかがう日とオンラインの日を、うまく並べます"
              body="おうちにうかがう日は移動の時間が要りますが、オンラインなら要りません。前後の予定の組み合わせを見て、間に合う時間だけをお客様に出します。埋まっている時間には理由も出ます。"
            />
            <Point
              n="02"
              title="定期のお客様の「今回だけ」に強い"
              body="「今回だけお休み」「今回だけ時間をずらす」と決めたあとに、曜日そのものを変えても、せっかく調整した回は消えません。"
            />
            <Point
              n="03"
              title="領収書がボタン1つで出せます"
              body="法律で決められた書き方になっているかを毎回たしかめます。消費税の1円未満も、税務署の求める順番で処理します。出した書類はそのまま7年ぶん保管されます。"
            />
            <Point
              n="04"
              title="決算前の「あの書類どこ？」がなくなる"
              body="お仕事を「終わった」にする、レシートを撮る。このふたつだけで、税理士さんに渡す資料がひとりでにできあがります。"
            />
          </div>
        </section>

        <section className="mt-12 rounded-card border border-slate-200/80 bg-surface p-6 shadow-card">
          <h2 className="text-sm font-bold tracking-tight text-ink">つながっているもの</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            合いことばを入れるまでは「お試し」で動きます。お試し中でも送る中身は本番とまったく同じなので、
            <b>いま見えているとおりに、本番でも動きます</b>。つなぎこみの作業はこちらで代行できます。
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            <ModeChip label="LINE" mode={line} />
            <ModeChip label="Googleカレンダー" mode={google} />
            <ModeChip label="レシートの読み取り" mode={ocr} />
          </ul>
        </section>

        <section className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-2xs text-slate-500">
          <span>お客様 {customers}名</span>
          <span>メニュー {menus}件</span>
          <span>予約 {reservations}件</span>
          <span>定期のお客様 {rules}組</span>
          <span>出した領収書 {invoices}件</span>
          <span>帳簿の記録 {entries}件</span>
        </section>

        <p className="mt-6 rounded-card border border-warn-100 bg-warn-50 px-4 py-3 text-xs leading-relaxed text-warn-700">
          いまの設定はぜんぶ仮の数字です。お店の名前「{settings.issuerName}」、登録番号「
          {settings.registrationNumber}」、料金・お仕事の時間・移動にかかる時間なども仮のもので、
          <Link href="/admin/settings" className="mx-1 font-bold underline">
            お店の設定
          </Link>
          からその場で書きかえられます。
        </p>
      </div>
    </main>
  );
}

function EntryCard({
  href,
  eyebrow,
  title,
  body,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-card border p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift ${
        accent
          ? "border-brand-700/20 bg-brand-sheen text-white"
          : "border-slate-200/80 bg-surface hover:border-brand-200"
      }`}
    >
      <p
        className={`text-2xs font-bold tracking-wide ${accent ? "text-white/80" : "text-brand-600"}`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-xl font-extrabold tracking-tighter">{title}</h2>
      <p
        className={`mt-2 text-xs leading-relaxed ${accent ? "text-white/85" : "text-slate-600"}`}
      >
        {body}
      </p>
      <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold">
        開く
        <Icon name="arrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </p>
    </Link>
  );
}

function Point({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-card border border-slate-200/80 bg-surface p-5 shadow-card">
      <p className="text-2xs font-bold tabular-nums tracking-widest text-brand-400">{n}</p>
      <h3 className="mt-1.5 text-sm font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function ModeChip({ label, mode }: { label: string; mode: "live" | "mock" }) {
  const live = mode === "live";
  return (
    <li
      className={`flex items-center gap-2 rounded-pill border px-3.5 py-2 text-2xs font-bold ${
        live ? "border-good-100 bg-good-50 text-good-700" : "border-slate-200 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-good-600" : "bg-brand-400"}`}
        aria-hidden
      />
      {label}
      <span className="ml-auto font-medium text-slate-500">{live ? "つながっています" : "お試し"}</span>
    </li>
  );
}
