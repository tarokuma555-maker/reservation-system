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
      <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-bold text-ink">1. レシートを読み取る</p>

        {mode === "mock" ? (
          <label className="block text-xs text-slate-500">
            サンプルのレシートを選ぶ（モックモード）
            <select
              name="sampleKey"
              value={sampleKey}
              onChange={(e) => setSampleKey(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-sage-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "読み取り中…" : "読み取る"}
        </button>

        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      </form>

      {parsed ? (
        <form
          action={createExpenseAction}
          className="space-y-3 rounded-xl border border-sage-300 bg-sage-50 p-4"
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
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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

          <div className="rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600">
            <p>
              <b>登録番号</b>:{" "}
              {parsed.registrationNumber ? (
                <span className="text-sage-700">{parsed.registrationNumber}（適格請求書）</span>
              ) : (
                <span className="text-clay-600">
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
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-100">
              {parsed.rawText}
            </pre>
          </details>

          <label className="block text-xs text-slate-600">
            メモ
            <input
              name="note"
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <button className="w-full rounded-lg bg-sage-600 py-2.5 text-sm font-medium text-white">
            経費として登録し、仕訳を起こす
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
        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
