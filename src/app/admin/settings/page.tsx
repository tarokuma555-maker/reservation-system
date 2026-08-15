import { getSettings } from "@/lib/settings";
import { updateSettingsAction } from "@/app/actions";
import { Card, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CONFIRM_PHRASE, demoDataCounts, isDemoData } from "@/lib/reset";
import StartProductionCard from "@/components/StartProductionCard";

export const dynamic = "force-dynamic";

/**
 * 設定画面。
 *
 * 「何をどう変えると、どこがどう変わるのか」が読むだけで分かることを最優先にしている。
 * 専門用語をそのまま項目名にせず、日常の言葉で書いたうえで、
 * 例と「変えるとこうなる」を必ず添える。
 * 税務の判断が必要なものは下の方にまとめ、税理士さんと決める項目だと明記する。
 */
export default async function SettingsPage() {
  const [s, stillDemo, counts] = await Promise.all([
    getSettings(),
    isDemoData(),
    demoDataCounts(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">お店の設定</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          ここを変えると、お客様に見える空き時間や、発行する書類の中身がすぐ変わります。
          迷ったらそのままで大丈夫です。あとからいつでも変えられます。
        </p>
      </header>

      {stillDemo ? (
        <div className="flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3">
          <Icon name="info" className="mt-0.5 h-4 w-4 text-warn-600" />
          <p className="text-xs leading-relaxed text-warn-700">
            いまは<b>すべて仮の値</b>が入っています。実際の料金・営業時間・登録番号が決まったら、
            ここを書き換えてください。
            架空のお客様やご予約は、<b>このページのいちばん下</b>でまとめて消せます。
          </p>
        </div>
      ) : null}

      <form action={updateSettingsAction} className="space-y-6">
        {/* ------------ お店の情報 ------------ */}
        <Card>
          <SectionTitle hint="領収書や請求書に、そのまま印字されます">お店の情報</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="お店の名前"
              name="issuerName"
              defaultValue={s.issuerName}
              help="発行する書類の右上に出ます"
            />
            <Field
              label="インボイスの登録番号"
              name="registrationNumber"
              defaultValue={s.registrationNumber}
              help="「T」ではじまる14文字です。税務署からの通知書に書かれています"
              example="例: T1234567890123"
            />
          </div>
          <Field
            className="mt-5"
            label="拠点の住所（自宅や事務所）"
            name="baseAddress"
            defaultValue={s.baseAddress}
            help="オンライン相談をする場所であり、訪問先との行き来にかかる時間を計算する起点になります"
          />
        </Card>

        {/* ------------ 移動時間 ------------ */}
        <Card>
          <SectionTitle hint="ここを長くすると予約と予約の間隔が広がり、短くすると詰められます">
            移動にかかる時間
          </SectionTitle>
          <p className="mb-4 text-xs leading-relaxed text-slate-600">
            前のお仕事と次のお仕事の<b>組み合わせ</b>によって、必要な移動時間は変わります。
            オンラインは拠点から行うので、移動がいらない組み合わせもあります。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <BufferField
              from="訪問"
              to="訪問"
              note="おうちからおうちへ移動します"
              name="visit_visit"
              value={s.travelBuffer.visit_visit}
            />
            <BufferField
              from="訪問"
              to="オンライン"
              note="拠点に戻ってから始めます"
              name="visit_online"
              value={s.travelBuffer.visit_online}
            />
            <BufferField
              from="オンライン"
              to="訪問"
              note="拠点から出発します"
              name="online_visit"
              value={s.travelBuffer.online_visit}
            />
            <BufferField
              from="オンライン"
              to="オンライン"
              note="移動なし。切り替えの時間だけです"
              name="online_online"
              value={s.travelBuffer.online_online}
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="お仕事のまえの準備時間"
              name="prepBeforeMinutes"
              type="number"
              unit="分"
              defaultValue={String(s.prepBeforeMinutes)}
              help="道具の用意やご挨拶にあてる時間です"
            />
            <Field
              label="お仕事のあとの片付け時間"
              name="prepAfterMinutes"
              type="number"
              unit="分"
              defaultValue={String(s.prepAfterMinutes)}
              help="片付けや記録を書く時間です"
            />
          </div>
        </Card>

        {/* ------------ 予約の受け付け方 ------------ */}
        <Card>
          <SectionTitle hint="お客様の画面に出る「選べる時間」が変わります">予約の受け付け方</SectionTitle>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="訪問は何時間前まで受け付ける？"
              name="cutoff_visit"
              type="number"
              unit="時間前まで"
              defaultValue={String(s.cutoffHours.visit)}
              help="これより直前の時間は、お客様の画面に出なくなります"
              example="例: 24 と入れると、前日の同じ時刻までの受付になります"
            />
            <Field
              label="オンラインは何時間前まで？"
              name="cutoff_online"
              type="number"
              unit="時間前まで"
              defaultValue={String(s.cutoffHours.online)}
              help="移動の支度がいらないぶん、訪問より短くできます"
            />
            <Field
              label="1日に受ける訪問の件数"
              name="max_visit"
              type="number"
              unit="件まで"
              defaultValue={String(s.maxPerDay.visit)}
              help="これに達した日は、訪問の空き時間が出なくなります"
            />
            <Field
              label="1日に受けるオンラインの件数"
              name="max_online"
              type="number"
              unit="件まで"
              defaultValue={String(s.maxPerDay.online)}
              help="訪問とは別に数えます"
            />
            <Field
              label="何日先まで予約できる？"
              name="bookingWindowDays"
              type="number"
              unit="日先まで"
              defaultValue={String(s.bookingWindowDays)}
              help="長くしすぎると、先の予定が埋まって動かしにくくなります"
            />
          </div>
        </Card>

        {/* ------------ 対応エリア ------------ */}
        <Card>
          <SectionTitle hint="ここに書いていない地域のお客様には、オンラインをご案内します">
            うかがえる地域
          </SectionTitle>
          <Field
            label="訪問できる市区町村"
            name="serviceAreas"
            defaultValue={s.serviceAreas.join("、")}
            help="読点（、）で区切って並べてください。オンラインは全国どこでもご利用いただけるので、ここは訪問だけの設定です"
            example="例: 世田谷区、目黒区、渋谷区"
          />
        </Card>

        {/* ------------ 税金まわり ------------ */}
        <Card className="border-slate-200 bg-brand-50/30">
          <SectionTitle hint="迷ったら、そのままで大丈夫です">
            税金まわり（税理士さんと決める項目）
          </SectionTitle>
          <p className="mb-4 text-xs leading-relaxed text-slate-600">
            ここは金額の計算に関わるところです。
            <b>どれを選ぶかは税務の判断になるため、顧問の税理士さんにご確認ください。</b>
            設定した内容は、領収書の消費税の出し方と、売上のまとめ方に反映されます。
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="決算月"
              name="fiscalYearEndMonth"
              type="number"
              unit="月"
              defaultValue={String(s.fiscalYearEndMonth)}
              help="1年の区切りです。この月の末日で締めて集計します"
            />
            <Select
              label="消費税の納め方"
              name="taxMethod"
              defaultValue={s.taxMethod}
              help="どちらが有利かは売上と経費の状況で変わります"
              options={[
                { value: "kani", label: "簡易課税（売上から決まった割合で計算する）" },
                { value: "honsoku", label: "本則課税（実際に払った消費税で計算する）" },
              ]}
            />
            <Select
              label="1円未満が出たときの扱い"
              name="roundingMode"
              defaultValue={s.roundingMode}
              help="消費税の計算で端数が出たときの決まりです。一般には切捨てが使われます"
              options={[
                { value: "floor", label: "切り捨てる" },
                { value: "ceil", label: "切り上げる" },
                { value: "round", label: "四捨五入する" },
              ]}
            />
          </div>
        </Card>

        {/* 画面のどこにいても押せるように下に貼りつくが、入力欄に重ならないよう帯にする */}
        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-4 border-t border-slate-200/80 bg-ground/95 px-1 py-3 backdrop-blur">
          <p className="text-2xs text-slate-500">
            変えたところは、保存を押すまで反映されません
          </p>
          <button className="inline-flex items-center gap-2 rounded-pill bg-brand-600 px-7 py-3 text-sm font-bold text-white shadow-lift transition hover:bg-brand-700">
            <Icon name="check" className="h-4 w-4" />
            この内容で保存する
          </button>
        </div>
      </form>

      {/* ------------ キャンセルの決まり ------------ */}
      <Card>
        <SectionTitle hint="お客様の画面にもこのとおり表示されます">いまのキャンセルの決まり</SectionTitle>
        <ul className="divide-y divide-slate-100">
          {s.cancelPolicy.map((p) => (
            <li key={p.hoursBefore} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-slate-700">
                {p.hoursBefore === 0
                  ? "当日"
                  : p.hoursBefore <= 24
                    ? "前日"
                    : `${Math.round(p.hoursBefore / 24)}日前まで`}
                <span className="ml-2 text-2xs text-slate-400">
                  {p.hoursBefore === 0 ? "" : `（${p.hoursBefore}時間より前）`}
                </span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                <span className="font-bold tabular-nums">
                  {p.feeRate === 0 ? "無料" : `料金の${p.feeRate}%`}
                </span>
                {!p.selfServiceAllowed ? (
                  <span className="rounded-pill bg-slate-100 px-2.5 py-1 text-2xs text-slate-600">
                    お客様ご自身では取り消せません
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          この決まりは、実際の運用に合わせてこちらで設定します。
          「何時間前まで無料にしたいか」をお知らせいただければ、その形に変更します。
        </p>
      </Card>

      {/* ------------ 本番として使いはじめる ------------ */}
      {stillDemo ? (
        <StartProductionCard counts={counts} confirmPhrase={CONFIRM_PHRASE} />
      ) : null}
    </div>
  );
}

/* ---------------- 部品 ---------------- */

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  unit,
  help,
  example,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  unit?: string;
  help?: string;
  example?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-bold text-ink">{label}</span>
      {help ? (
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{help}</span>
      ) : null}
      <span className="mt-2 flex items-center gap-2">
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          className={`rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm ${
            type === "number" ? "w-28 tabular-nums" : "w-full"
          }`}
        />
        {unit ? <span className="shrink-0 text-sm text-slate-500">{unit}</span> : null}
      </span>
      {example ? (
        <span className="mt-1.5 block text-2xs text-slate-400">{example}</span>
      ) : null}
    </label>
  );
}

function BufferField({
  from,
  to,
  note,
  name,
  value,
}: {
  from: string;
  to: string;
  note: string;
  name: string;
  value: number;
}) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-brand-50/40 p-4">
      <span className="flex items-center gap-2 text-sm font-bold text-ink">
        <Icon name={from === "訪問" ? "visit" : "online"} className="h-4 w-4 text-slate-400" />
        {from}
        <Icon name="arrowRight" className="h-3.5 w-3.5 text-slate-400" />
        <Icon name={to === "訪問" ? "visit" : "online"} className="h-4 w-4 text-slate-400" />
        {to}
      </span>
      <span className="mt-1 block text-xs text-slate-500">{note}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          name={name}
          type="number"
          defaultValue={String(value)}
          className="w-24 rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm tabular-nums"
        />
        <span className="text-sm text-slate-500">分</span>
      </span>
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  help,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-ink">{label}</span>
      {help ? (
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{help}</span>
      ) : null}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
