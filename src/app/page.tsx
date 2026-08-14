import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { lineMode } from "@/lib/line";
import { googleMode } from "@/lib/google-calendar";
import { ocrMode } from "@/lib/ocr";

export const dynamic = "force-dynamic";

export default async function Home() {
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
            予約から会計・決算書まで、すべて本物のロジックで動いています。
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <EntryCard
            href="/liff"
            eyebrow="お客様側"
            title="LINEの画面"
            body="リッチメニューから予約・変更・キャンセル・定期利用の申込みまで。届く通知もそのまま確認できます。"
            accent
          />
          <EntryCard
            href="/admin"
            eyebrow="オーナー側"
            title="管理画面"
            body="スケジュール管理、定期予約のイレギュラー対応、インボイス発行、経費とレシート・書類、帳簿と決算書。"
          />
        </div>

        <section className="mt-14">
          <h2 className="text-sm font-bold tracking-tight text-ink">このデモで見ていただきたい4つ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Point
              n="01"
              title="提供形態で分岐する空き枠"
              body="訪問とオンラインでは、必要な情報も移動時間も違います。前後の予約の組み合わせで必要な移動時間を計算し、埋まっている枠には理由を出します。"
            />
            <Point
              n="02"
              title="定期予約のイレギュラー対応"
              body="「今回だけ休む」「今回だけ日時変更」をしても、あとからルールを変更した際にその回が消えません。"
            />
            <Point
              n="03"
              title="適格請求書とPDF"
              body="法定6項目を検証し、税率ごとに1回だけ1円未満の扱いします。PDFは実際に生成され、レシート・書類として保存されます。"
            />
            <Point
              n="04"
              title="帳簿から決算書まで"
              body="予約と経費が自動で仕訳になり、科目ごとの残高・計算書類4表・消費税集計まで積み上がります。"
            />
          </div>
        </section>

        <section className="mt-12 rounded-card border border-slate-200/80 bg-surface p-6 shadow-card">
          <h2 className="text-sm font-bold tracking-tight text-ink">外部連携のいまの状態</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            つなぎこみの設定が済むまでは「お試し」で動きます。送る中身は本番とまったく同じものを組み立てているため、
            <b>いま見えている挙動がそのまま本番の挙動</b>です。
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            <ModeChip label="LINE Messaging API" mode={lineMode()} />
            <ModeChip label="Googleカレンダー" mode={googleMode()} />
            <ModeChip label="レシートの読み取り" mode={ocrMode()} />
          </ul>
        </section>

        <section className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-2xs text-slate-500">
          <span>顧客 {customers}名</span>
          <span>メニュー {menus}件</span>
          <span>予約 {reservations}件</span>
          <span>定期ルール {rules}本</span>
          <span>発行済み書類 {invoices}件</span>
          <span>仕訳 {entries}件</span>
        </section>

        <p className="mt-6 rounded-card border border-warn-100 bg-warn-50 px-4 py-3 text-xs leading-relaxed text-warn-700">
          設定値はすべて仮置きです。事業者名「{settings.issuerName}」、登録番号「
          {settings.registrationNumber}」、料金・営業時間・移動時間なども仮の値で、
          <Link href="/admin/settings" className="mx-1 font-bold underline">
            管理画面の設定
          </Link>
          からその場で変更できます。
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
      <p className="mt-4 text-xs font-bold">
        開く <span className="inline-block transition group-hover:translate-x-1">→</span>
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
