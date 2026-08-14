"use client";

import { useActionState } from "react";
import { issueInvoiceAction, type InvoiceActionState } from "@/app/actions";
import { Icon } from "@/components/Icon";

type Candidate = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

export default function InvoiceIssueForm({
  customers,
}: {
  customers: { id: string; name: string; candidates: Candidate[] }[];
}) {
  const [state, formAction, pending] = useActionState<InvoiceActionState, FormData>(
    issueInvoiceAction,
    {}
  );

  const withCandidates = customers.filter((c) => c.candidates.length > 0);

  if (withCandidates.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        いま出すものはありません。予定表でお仕事を「終わった」にすると、ここに出てきます。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.ok ? (
        <p className="rounded-xl border border-good-100 bg-good-50 px-3.5 py-2.5 text-sm font-medium text-good-700">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" className="h-4 w-4" />
            {state.ok}
          </span>
        </p>
      ) : null}
      {state.error ? (
        <div className="rounded-card border border-bad-100 bg-bad-50 px-4 py-3 text-sm text-bad-700">
          <p className="inline-flex items-center gap-1.5 font-bold">
            <Icon name="alert" className="h-4 w-4" />
            {state.error}
          </p>
          {state.errors?.length ? (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {withCandidates.map((c) => (
        <form key={c.id} action={formAction} className="rounded-card border border-slate-200/80 p-5">
          <input type="hidden" name="customerId" value={c.id} />
          <p className="mb-2 text-sm font-bold text-ink">{c.name}</p>
          <div className="space-y-1.5">
            {c.candidates.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="reservationIds"
                  value={r.id}
                  defaultChecked
                  className="h-4 w-4 accent-[#47705f]"
                />
                <span className="flex-1 truncate">
                  <span className="text-slate-500">{r.date}</span> {r.label}
                </span>
                <span className="shrink-0 tabular-nums">¥{r.amount.toLocaleString("ja-JP")}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              name="type"
              className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              defaultValue="receipt"
            >
              <option value="receipt">領収書にする</option>
              <option value="invoice">請求書にする</option>
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "つくっています…" : "つくってLINEでお送りする"}
            </button>
            <span className="text-xs text-slate-500">
              いくつか選ぶと、1枚にまとめて出せます
            </span>
          </div>
        </form>
      ))}
    </div>
  );
}
