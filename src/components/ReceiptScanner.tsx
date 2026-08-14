"use client";

import { useActionState, useState } from "react";
import { createExpenseAction, ocrReceiptAction, type OcrState } from "@/app/actions";

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
        <p className="text-sm font-bold text-ink">1. レシートを読み取る</p>

        {mode === "mock" ? (
          <label className="block text-xs text-slate-500">
            サンプルのレシートを選ぶ（お試しモード）
            <select
              name="sampleKey"
              value={sampleKey}
              onChange={(e) => setSampleKey(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            >
              {samples.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs text-slate-500">
            レシートの写真
            <input
              type="file"
              name="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-pill bg-brand-600 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-45"
        >
          {pending ? "読み取り中…" : "読み取る"}
        </button>

        {state.error ? <p className="text-sm text-bad-600">{state.error}</p> : null}
      </form>

      {parsed ? (
        <form
          action={createExpenseAction}
          className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4"
        >
          <p className="text-sm font-bold text-ink">2. 読み取り結果を確認して登録する</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="取引年月日" name="expenseDate" type="date" defaultValue={parsed.transactionDate ?? ""} />
            <Field
              label="金額（税込）"
              name="amount"
              type="number"
              defaultValue={String(parsed.totalAmount ?? "")}
            />
            <Field label="取引先" name="vendorName" defaultValue={parsed.vendorName} />
            <label className="block text-xs text-slate-600">
              勘定科目（推定済み）
              <select
                name="accountCode"
                defaultValue={parsed.suggestedAccountCode}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              消費税区分
              <select
                name="taxCategory"
                defaultValue={parsed.taxRate === 8 ? "軽減8" : "課税10"}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm"
              >
                <option value="課税10">課税10%</option>
                <option value="軽減8">軽減8%</option>
                <option value="非課税">非課税</option>
                <option value="不課税">不課税</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              インボイスの区分
              <select
                name="invoiceStatus"
                defaultValue={
                  parsed.hasQualifiedInvoice
                    ? "qualified"
                    : parsed.smallAmountException
                      ? "small_amount_exception"
                      : "non_qualified"
                }
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm"
              >
                <option value="qualified">適格請求書あり（全額控除）</option>
                <option value="non_qualified">適格請求書なし（経過措置）</option>
                <option value="small_amount_exception">少額特例（税込1万円未満）</option>
              </select>
            </label>
          </div>

          <input
            type="hidden"
            name="vendorRegistrationNumber"
            value={parsed.registrationNumber ?? ""}
          />
          <input type="hidden" name="ocrRawText" value={parsed.rawText} />

          <div className="rounded-lg bg-surface p-3 text-xs leading-relaxed text-slate-600">
            <p>
              <b>登録番号</b>:{" "}
              {parsed.registrationNumber ? (
                <span className="text-brand-700">{parsed.registrationNumber}（適格請求書）</span>
              ) : (
                <span className="text-ocean-600">
                  読み取れませんでした
                  {parsed.smallAmountException
                    ? " — 税込1万円未満のため少額特例の対象になり得ます"
                    : " — 経過措置の割合でのみ控除できます"}
                </span>
              )}
            </p>
          </div>

          <details>
            <summary className="cursor-pointer text-xs text-slate-500">読み取った文字列を見る</summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3.5 text-[10px] leading-relaxed text-brand-100">
              {parsed.rawText}
            </pre>
          </details>

          <label className="block text-xs text-slate-600">
            メモ
            <input
              name="note"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            />
          </label>

          <button className="w-full rounded-pill bg-brand-600 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700">
            経費として登録し、帳簿に記録する
          </button>
        </form>
      ) : null}
    </div>
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
    <label className="block text-xs text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm"
      />
    </label>
  );
}
