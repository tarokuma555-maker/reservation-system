"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";

/**
 * 「押したあと、どうなったのか」を必ず出すための部品。
 *
 * 押した瞬間に見た目が変わらないと、効いていないのかと思って
 * 何度も押してしまう。押している最中・終わったあとの両方を出す。
 */

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-card hover:bg-brand-700",
  secondary:
    "border border-slate-200 bg-surface text-slate-700 hover:border-brand-300 hover:text-brand-700",
  danger: "border border-bad-100 bg-surface text-bad-700 hover:bg-bad-50",
};

/**
 * 押している最中は、文字を変えて押せなくする。
 * 二重に登録されるのを防ぐ意味もある。
 */
export function SubmitButton({
  children,
  pendingLabel = "処理しています…",
  variant = "primary",
  size = "md",
  icon,
  className = "",
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: "sm" | "md";
  icon?: React.ComponentProps<typeof Icon>["name"];
  className?: string;
  /** 取り消せない操作のときだけ、押す前に一度確かめる */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const sizeCls = size === "sm" ? "px-3.5 py-1.5 text-2xs" : "px-6 py-2.5 text-sm";

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`inline-flex items-center gap-1.5 rounded-pill font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizeCls} ${VARIANTS[variant]} ${className}`}
    >
      {pending ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : icon ? (
        <Icon name={icon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

/** できた・できなかったを、同じ見た目でどの画面にも出す */
export function FormResult({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;

  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-bad-100 bg-bad-50 px-4 py-3 text-xs leading-relaxed text-bad-700"
      >
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b className="block">できませんでした</b>
          {error}
        </span>
      </p>
    );
  }

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-good-100 bg-good-50 px-4 py-3 text-xs leading-relaxed text-good-700"
    >
      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.6} />
      <span className="font-bold">{ok}</span>
    </p>
  );
}
