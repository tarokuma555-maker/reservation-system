import Link from "next/link";

export function DeliveryBadge({ type, className = "" }: { type: string; className?: string }) {
  const visit = type === "visit";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        visit ? "bg-sage-100 text-sage-700" : "bg-clay-100 text-clay-600"
      } ${className}`}
    >
      {visit ? "🏠 訪問" : "💻 オンライン"}
    </span>
  );
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "確定", cls: "bg-sage-500 text-white" },
  completed: { label: "実施済", cls: "bg-slate-500 text-white" },
  cancelled_by_customer: { label: "お客様キャンセル", cls: "bg-slate-200 text-slate-600" },
  cancelled_by_owner: { label: "こちらでキャンセル", cls: "bg-slate-200 text-slate-600" },
  skipped: { label: "スキップ", cls: "bg-amber-100 text-amber-700" },
  no_show: { label: "無断キャンセル", cls: "bg-rose-100 text-rose-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: "bg-slate-200 text-slate-600" };
  return (
    <span className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: "未入金", cls: "bg-rose-50 text-rose-600 border-rose-200" },
    cash_received: { label: "現金受領", cls: "bg-sage-50 text-sage-700 border-sage-300" },
    transfer_confirmed: { label: "振込確認済", cls: "bg-sage-50 text-sage-700 border-sage-300" },
  };
  const s = map[status] ?? map.unpaid;
  return <span className={`rounded border px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-ink">{children}</h2>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-sage-600 text-white hover:bg-sage-700",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
  }[variant];
  return (
    <button
      {...rest}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-sage-600 text-white" : "text-slate-700 hover:bg-sage-50"
      }`}
    >
      {children}
    </Link>
  );
}

/** 仮置きの値であることを明示するラベル */
export function ProvisionalNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {children}
    </p>
  );
}
