"use client";

import { useActionState, useState } from "react";
import { createExpenseAction, ocrReceiptAction, type OcrState } from "@/app/actions";
import { Icon } from "@/components/Icon";

type Account = { code: string; name: string };
type Sample = { key: string; label: string };

export default function ReceiptScanner({
  accounts,
  samples,
  mode,
}: {
  accounts: Account[];
  samples: Sample[];
  mode: "live" | "mock";
}) {
  const [state, formAction, pending] = useActionState<OcrState, FormData>(ocrReceiptAction, {});
  const [sampleKey, setSampleKey] = useState(samples[0]?.key ?? "homecenter");

  const parsed = state.parsed;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3 rounded-card border border-slate-200/80 p-5">
        <Step n={1} title="レシートをえらぶ" />

        {mode === "mock" ? (
          <label className="block">
            <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
              ためしに使うレシート
            </span>
            <select
              name="sampleKey"
              value={sampleKey}
              onChange={(e) => setSampleKey(e.target.value)}
              className={inputCls}
            >
              {samples.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
              レシートの写真
            </span>
            <input
              type="file"
              name="file"
              accept="image/*"
              capture="environment"
              className={inputCls}
            />
            <span className="mt-1 block text-2xs text-slate-500">
              まっすぐ、明るいところで撮ると読み取りやすくなります
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-brand-600 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-45"
        >
          <Icon name="camera" className="h-4 w-4" />
          {pending ? "読んでいます…" : "読み取る"}
        </button>

        {state.error ? (
          <p className="flex items-start gap-1.5 text-sm text-bad-600">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
      </form>

      {parsed ? (
        <form
          action={createExpenseAction}
          className="space-y-3 rounded-card border border-brand-200 bg-brand-50 p-5"
        >
          <Step n={2} title="読み取った内容を確かめる" />
          <p className="text-xs leading-relaxed text-slate-600">
            ちがっているところがあれば、そのまま書き直せます。
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="いつ買ったか"
              name="expenseDate"
              type="date"
              defaultValue={parsed.transactionDate ?? ""}
            />
            <Field
              label="いくら（税こみ）"
              name="amount"
              type="number"
              defaultValue={String(parsed.totalAmount ?? "")}
            />
            <Field label="どこのお店" name="vendorName" defaultValue={parsed.vendorName} />
            <label className="block">
              <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
                なんの費用にするか
              </span>
              <select name="accountCode" defaultValue={parsed.suggestedAccountCode} className={inputCls}>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-2xs text-slate-500">
                お店の名前から見当をつけてあります
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
                消費税
              </span>
              <select
                name="taxCategory"
                defaultValue={parsed.taxRate === 8 ? "軽減8" : "課税10"}
                className={inputCls}
              >
                <option value="課税10">10%（ふつうの買い物）</option>
                <option value="軽減8">8%（食べもの・飲みもの）</option>
                <option value="非課税">かからないもの</option>
                <option value="不課税">対象外（お祝い金など）</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
                消費税を差し引けるか
              </span>
              <select
                name="invoiceStatus"
                defaultValue={
                  parsed.hasQualifiedInvoice
                    ? "qualified"
                    : parsed.smallAmountException
                      ? "small_amount_exception"
                      : "non_qualified"
                }
                className={inputCls}
              >
                <option value="qualified">まるごと差し引ける（登録番号あり）</option>
                <option value="non_qualified">一部だけ差し引ける（登録番号なし）</option>
                <option value="small_amount_exception">少額なので差し引ける（1万円未満）</option>
              </select>
            </label>
          </div>

          <input
            type="hidden"
            name="vendorRegistrationNumber"
            value={parsed.registrationNumber ?? ""}
          />
          <input type="hidden" name="ocrRawText" value={parsed.rawText} />

          <div className="flex gap-2.5 rounded-xl bg-surface p-3.5">
            <Icon
              name={parsed.registrationNumber ? "check" : "info"}
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                parsed.registrationNumber ? "text-good-600" : "text-ocean-600"
              }`}
            />
            <p className="text-xs leading-relaxed text-slate-600">
              {parsed.registrationNumber ? (
                <>
                  お店の登録番号が読み取れました（{parsed.registrationNumber}）。
                  このレシートは、消費税をまるごと差し引けます。
                </>
              ) : (
                <>
                  お店の登録番号が見つかりませんでした。
                  {parsed.smallAmountException
                    ? "ただし1万円未満のお買い物なので、差し引ける決まりになっています。"
                    : "この場合、消費税は決められた割合ぶんだけ差し引けます。"}
                </>
              )}
            </p>
          </div>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs text-slate-500 transition hover:text-slate-700">
              <Icon name="chevronRight" className="h-3 w-3 transition group-open:rotate-90" />
              レシートから読み取った文字を見る
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3.5 text-[10px] leading-relaxed text-brand-100">
              {parsed.rawText}
            </pre>
          </details>

          <label className="block">
            <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">
              メモ（なくても大丈夫です）
            </span>
            <input name="note" placeholder="お客様宅で使う洗剤 など" className={inputCls} />
          </label>

          <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-brand-600 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
            <Icon name="check" className="h-4 w-4" />
            経費として入れる
          </button>
          <p className="text-2xs leading-relaxed text-slate-500">
            押すと、帳簿への記録と、レシートの7年間の保管まで、まとめて済みます。
          </p>
        </form>
      ) : null}
    </div>
  );
}

const inputCls =
  "block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm placeholder:text-slate-400";

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-ink">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-2xs text-white">
        {n}
      </span>
      {title}
    </p>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className={inputCls} />
    </label>
  );
}
