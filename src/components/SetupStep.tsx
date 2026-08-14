import { Icon } from "@/components/Icon";

/**
 * 「準備の手順」を1つずつ示すための枠。
 *
 * 設定画面がわかりにくくなるいちばんの原因は、やることが同じ重みで並んでいて
 * どこから手をつければいいか分からないこと。番号と、終わったかどうかを必ず添える。
 */
export function SetupStep({
  n,
  title,
  summary,
  done,
  optional,
  children,
}: {
  n: number;
  title: string;
  summary?: string;
  done: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border shadow-card transition ${
        done ? "border-good-100 bg-good-50/40" : "border-slate-200/80 bg-surface"
      }`}
    >
      <div className="flex items-start gap-4 px-5 pt-5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-good-600 text-white" : "bg-brand-600 text-white"
          }`}
        >
          {done ? <Icon name="check" className="h-4 w-4" strokeWidth={2.6} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-[15px] font-bold tracking-tight text-ink">{title}</h2>
            {optional ? (
              <span className="rounded-pill bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-500">
                あとでも大丈夫
              </span>
            ) : null}
            {done ? (
              <span className="rounded-pill bg-good-600 px-2.5 py-0.5 text-2xs font-bold text-white">
                おわりました
              </span>
            ) : null}
          </div>
          {summary ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{summary}</p>
          ) : null}
        </div>
      </div>
      <div className="px-5 pb-5 pt-4 sm:pl-[68px]">{children}</div>
    </section>
  );
}

/** 手順の中の「あちらの画面でやること」を、番号つきで並べる */
export function Howto({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-700">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
            {i + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** 準備がどこまで進んだかを、画面のいちばん上に出す */
export function SetupProgress({
  steps,
}: {
  steps: { label: string; done: boolean }[];
}) {
  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;

  return (
    <div
      className={`rounded-card border px-5 py-4 shadow-card ${
        allDone ? "border-good-100 bg-good-50" : "border-brand-200 bg-brand-50/60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm font-bold ${allDone ? "text-good-700" : "text-ink"}`}>
          {allDone
            ? "準備はすべて終わっています"
            : `準備は ${done} / ${steps.length} まで進んでいます`}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {steps.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1.5 text-2xs font-bold ${
                s.done ? "text-good-700" : "text-slate-400"
              }`}
            >
              <Icon
                name={s.done ? "check" : "clock"}
                className="h-3.5 w-3.5"
                strokeWidth={s.done ? 2.6 : 1.7}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
