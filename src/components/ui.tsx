import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/* ---------------- バッジ類 ---------------- */

export function DeliveryBadge({ type, className = "" }: { type: string; className?: string }) {
  const visit = type === "visit";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-bold ${
        visit
          ? "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200"
          : "bg-ocean-100 text-ocean-700 ring-1 ring-inset ring-ocean-500/25"
      } ${className}`}
    >
      <Icon name={visit ? "visit" : "online"} className="h-3.5 w-3.5" />
      {visit ? "訪問" : "オンライン"}
    </span>
  );
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "確定", cls: "bg-brand-600 text-white" },
  completed: { label: "実施済", cls: "bg-slate-200 text-slate-700" },
  cancelled_by_customer: { label: "お客様キャンセル", cls: "bg-slate-100 text-slate-500" },
  cancelled_by_owner: { label: "こちらでキャンセル", cls: "bg-slate-100 text-slate-500" },
  skipped: { label: "お休み", cls: "bg-warn-100 text-warn-700" },
  no_show: { label: "無断キャンセル", cls: "bg-bad-100 text-bad-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2.5 py-1 text-2xs font-bold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: "未入金", cls: "bg-bad-50 text-bad-700 ring-bad-100" },
    cash_received: { label: "現金受領", cls: "bg-good-50 text-good-700 ring-good-100" },
    transfer_confirmed: { label: "振込確認済", cls: "bg-good-50 text-good-700 ring-good-100" },
  };
  const s = map[status] ?? map.unpaid;
  return (
    <span className={`rounded-pill px-2.5 py-1 text-2xs font-bold ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ---------------- 面 ---------------- */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-slate-200/80 bg-surface p-5 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function IconLabel({
  name,
  children,
  className = "",
}: {
  name: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon name={name} className="h-4 w-4" />
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-bold tracking-tight text-ink">{children}</h2>
        {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-slate-300 bg-brand-50/40 px-6 py-10 text-center text-sm leading-relaxed text-slate-500">
      {children}
    </p>
  );
}

/* ---------------- 数字を見せる ---------------- */

export function StatTile({
  label,
  value,
  unit,
  sub,
  tone = "plain",
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "plain" | "brand" | "alert";
  href?: string;
}) {
  const tones = {
    plain: "border-slate-200/80 bg-surface",
    brand: "border-brand-700/20 bg-brand-sheen text-white shadow-lift",
    alert: "border-warn-100 bg-warn-50",
  }[tone];

  const labelTone = tone === "brand" ? "text-white/80" : "text-slate-500";
  const subTone = tone === "brand" ? "text-white/80" : "text-slate-500";

  const body = (
    <div className={`h-full rounded-card border p-5 shadow-card transition ${tones}`}>
      <p className={`text-2xs font-bold tracking-wide ${labelTone}`}>{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tracking-tighter tabular-nums">{value}</span>
        {unit ? <span className="text-xs font-medium opacity-70">{unit}</span> : null}
      </p>
      {sub ? <p className={`mt-1 text-2xs ${subTone}`}>{sub}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ---------------- 操作 ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLE: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-card hover:bg-brand-700 active:translate-y-px",
  secondary:
    "border border-slate-200 bg-surface text-slate-700 hover:border-brand-300 hover:text-brand-700",
  ghost: "text-slate-600 hover:bg-brand-50 hover:text-brand-700",
  danger: "border border-bad-100 bg-surface text-bad-600 hover:bg-bad-50",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-bold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-45 ${sizing} ${BUTTON_STYLE[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  className = "",
  target,
  rel,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  target?: string;
  rel?: string;
}) {
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-bold tracking-tight transition ${sizing} ${BUTTON_STYLE[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/** フォーム部品の共通クラス */
export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-sm placeholder:text-slate-400";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-2xs font-bold tracking-wide text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-2xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

/* ---------------- 状態の告知 ---------------- */

export function ProvisionalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3">
      <Icon name="info" className="mt-0.5 h-4 w-4 text-warn-600" />
      <p className="text-xs leading-relaxed text-warn-700">{children}</p>
    </div>
  );
}

/** ライブ接続かモックかを、画面の最初に必ず示す帯 */
export function ModeBanner({
  live,
  liveTitle,
  mockTitle,
  children,
}: {
  live: boolean;
  liveTitle: string;
  mockTitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 rounded-card border px-4 py-3.5 ${
        live ? "border-good-100 bg-good-50" : "border-slate-200 bg-surface shadow-card"
      }`}
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${live ? "bg-good-600" : "bg-brand-500"}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={`text-sm font-bold ${live ? "text-good-700" : "text-ink"}`}>
          {live ? liveTitle : mockTitle}
        </p>
        {children ? (
          <div className="mt-1 text-xs leading-relaxed text-slate-600">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-700">
      {children}
    </code>
  );
}

/* ---------------- 表 ---------------- */

export function TableShell({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="scroll-x rounded-card border border-slate-200/80 bg-surface shadow-card">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-slate-200 bg-brand-50/60 px-4 py-2.5 text-2xs font-bold tracking-wide text-slate-600 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-2.5 ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
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
      className={`block rounded-pill px-3.5 py-2 text-sm font-medium transition ${
        active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
      }`}
    >
      {children}
    </Link>
  );
}

/** 旧コードとの互換 */
export const SubmitButton = Button;
