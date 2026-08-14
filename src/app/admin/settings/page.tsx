import { getSettings } from "@/lib/settings";
import { updateSettingsAction } from "@/app/actions";
import { Card, ProvisionalNote, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">設定</h1>
        <p className="text-sm text-slate-500">
          決まっていない項目は仮置きのままで動きます。決まり次第ここで差し替えてください。
        </p>
      </header>

      <ProvisionalNote>
        <b>いま仮置きになっている項目</b>: 事業者名 / 登録番号 / 決算月 / 課税方式 / 拠点住所 /
        移動バッファ / 受付締切 / 1日の上限件数 / 対応エリア。
        変更するとその場で空き枠の計算や書類の表示に反映されます。
      </ProvisionalNote>

      <form action={updateSettingsAction} className="space-y-6">
        <Card>
          <SectionTitle hint="発行する書類に印字されます">事業者情報（インボイス）</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="事業者名" name="issuerName" defaultValue={s.issuerName} />
            <Field
              label="適格請求書発行事業者の登録番号"
              name="registrationNumber"
              defaultValue={s.registrationNumber}
              hint="T + 数字13桁。形式が違うと発行できません"
            />
            <Field
              label="決算月"
              name="fiscalYearEndMonth"
              type="number"
              defaultValue={String(s.fiscalYearEndMonth)}
              hint="法人のため任意の月を指定できます"
            />
            <Select
              label="消費税の課税方式"
              name="taxMethod"
              defaultValue={s.taxMethod}
              hint="どちらが有利かは税理士にご確認ください"
              options={[
                { value: "kani", label: "簡易課税（第五種・サービス業）" },
                { value: "honsoku", label: "本則課税" },
              ]}
            />
            <Select
              label="消費税の端数処理"
              name="roundingMode"
              defaultValue={s.roundingMode}
              hint="税率ごとに1回だけ適用します"
              options={[
                { value: "floor", label: "切捨て" },
                { value: "ceil", label: "切上げ" },
                { value: "round", label: "四捨五入" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle hint="オンラインの実施場所であり、訪問との往復の基準点になります">
            拠点と移動時間
          </SectionTitle>
          <Field label="拠点（自宅・事務所）の住所" name="baseAddress" defaultValue={s.baseAddress} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="🏠訪問 → 🏠訪問"
              name="visit_visit"
              type="number"
              defaultValue={String(s.travelBuffer.visit_visit)}
              hint="訪問先間の移動（分）"
            />
            <Field
              label="🏠訪問 → 💻オンライン"
              name="visit_online"
              type="number"
              defaultValue={String(s.travelBuffer.visit_online)}
              hint="拠点への帰着（分）"
            />
            <Field
              label="💻オンライン → 🏠訪問"
              name="online_visit"
              type="number"
              defaultValue={String(s.travelBuffer.online_visit)}
              hint="拠点からの出発（分）"
            />
            <Field
              label="💻オンライン → 💻オンライン"
              name="online_online"
              type="number"
              defaultValue={String(s.travelBuffer.online_online)}
              hint="切替のみ（分）"
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="準備バッファ（前）"
              name="prepBeforeMinutes"
              type="number"
              defaultValue={String(s.prepBeforeMinutes)}
            />
            <Field
              label="片付けバッファ（後）"
              name="prepAfterMinutes"
              type="number"
              defaultValue={String(s.prepAfterMinutes)}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle hint="提供形態ごとに別々に設定できます">受付ルール</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="受付締切（訪問・時間前）"
              name="cutoff_visit"
              type="number"
              defaultValue={String(s.cutoffHours.visit)}
            />
            <Field
              label="受付締切（オンライン・時間前）"
              name="cutoff_online"
              type="number"
              defaultValue={String(s.cutoffHours.online)}
              hint="移動準備が不要な分、直前まで受けられます"
            />
            <Field
              label="予約可能期間（日）"
              name="bookingWindowDays"
              type="number"
              defaultValue={String(s.bookingWindowDays)}
            />
            <Field
              label="1日の上限（訪問）"
              name="max_visit"
              type="number"
              defaultValue={String(s.maxPerDay.visit)}
            />
            <Field
              label="1日の上限（オンライン）"
              name="max_online"
              type="number"
              defaultValue={String(s.maxPerDay.online)}
            />
          </div>
          <div className="mt-4">
            <Field
              label="訪問の対応エリア（読点・スペース区切り）"
              name="serviceAreas"
              defaultValue={s.serviceAreas.join("、")}
              hint="オンラインメニューには適用されません（全国対応）"
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <button className="rounded-pill bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
            設定を保存する
          </button>
        </div>
      </form>

      <Card>
        <SectionTitle>いまのキャンセルポリシー（仮置き）</SectionTitle>
        <ul className="space-y-1 text-sm text-slate-700">
          {s.cancelPolicy.map((p) => (
            <li key={p.hoursBefore} className="flex justify-between">
              <span>{p.hoursBefore === 0 ? "24時間未満" : `${p.hoursBefore}時間以上前`}</span>
              <span className="tabular-nums">
                キャンセル料 {p.feeRate}%
                {p.selfServiceAllowed ? "" : "・お客様側の操作は不可"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          デモでは編集画面を用意していません。実際のポリシーが決まり次第、ここも編集できるようにします。
        </p>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
      />
      {hint ? <span className="mt-1 block text-2xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-2xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
