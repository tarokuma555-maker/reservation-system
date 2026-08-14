import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, ProvisionalNote } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, counts] = await Promise.all([
    getSettings(),
    Promise.all([
      prisma.customer.count(),
      prisma.menu.count(),
      prisma.reservation.count(),
      prisma.recurringRule.count(),
      prisma.invoice.count(),
    ]),
  ]);
  const [customers, menus, reservations, rules, invoices] = counts;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-widest text-sage-600">DEMO</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">LINE予約システム</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          お掃除の家事代行・片付けコンサル向けの予約システムのデモです。
          お客様側（LINE）と管理側の両方を、実際に触って動かせます。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/liff" className="group">
          <Card className="h-full transition group-hover:border-sage-500 group-hover:shadow-md">
            <p className="text-2xl">📱</p>
            <h2 className="mt-2 font-bold text-ink">お客様側（LINE画面）</h2>
            <p className="mt-1 text-sm text-slate-600">
              リッチメニューから予約・変更・キャンセル・定期利用の申込みまで。
              LINE内で開くLIFFアプリを想定した画面です。
            </p>
            <p className="mt-3 text-sm font-medium text-sage-600">開く →</p>
          </Card>
        </Link>

        <Link href="/admin" className="group">
          <Card className="h-full transition group-hover:border-sage-500 group-hover:shadow-md">
            <p className="text-2xl">🗓️</p>
            <h2 className="mt-2 font-bold text-ink">管理画面</h2>
            <p className="mt-1 text-sm text-slate-600">
              スケジュール管理、定期予約のイレギュラー対応、顧客・メニュー管理、
              インボイスの発行、各種設定。
            </p>
            <p className="mt-3 text-sm font-medium text-sage-600">開く →</p>
          </Card>
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-ink">このデモで確認できること</h2>
        <Card>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <b>提供形態で分岐する予約フロー</b> — 訪問とオンラインで、必要な情報も空き枠の出方も変わります
            </li>
            <li>
              <b>移動時間バッファの4パターン</b> — 前後の予約の組み合わせで必要な移動時間を計算します。
              空き枠が埋まっている理由は管理画面で確認できます
            </li>
            <li>
              <b>定期予約のイレギュラー対応</b> — 「今回だけ休む」「今回だけ日時変更」をしても、
              ルール変更でその回が消えないことを確認できます
            </li>
            <li>
              <b>適格請求書（インボイス）の発行</b> — 税率ごとに1回だけ端数処理する計算と、
              法定6項目の検証が入っています
            </li>
          </ul>
        </Card>
      </section>

      <section className="mt-6">
        <ProvisionalNote>
          <b>設定値はすべて仮置きです。</b> 事業者名「{settings.issuerName}」、登録番号「
          {settings.registrationNumber}」、料金・営業時間・移動バッファなども仮の値です。
          <Link href="/admin/settings" className="underline">
            管理画面の設定
          </Link>
          からその場で変更できます。
        </ProvisionalNote>
      </section>

      <section className="mt-6 text-xs text-slate-500">
        <p>
          デモデータ: 顧客 {customers}名 / メニュー {menus}件 / 予約 {reservations}件 / 定期ルール{" "}
          {rules}本 / 発行済み書類 {invoices}件
        </p>
      </section>
    </main>
  );
}
