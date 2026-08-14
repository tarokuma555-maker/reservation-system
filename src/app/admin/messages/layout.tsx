import Link from "next/link";
import { getLineConnection } from "@/lib/line";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * LINEの画面は「準備すること」と「ようすを見ること」で性質がまったく違う。
 * 1枚に詰めると、どれが設定でどれが確認なのか見分けがつかなくなるので分ける。
 */
export default async function LineLayout({ children }: { children: React.ReactNode }) {
  const line = await getLineConnection();

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tighter text-ink">LINEの設定</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              お客様のLINEとこのシステムをつなぐ画面です。
            </p>
          </div>
          <ConnectionChip
            connected={line.connected}
            error={line.status === "error"}
            label={line.label}
          />
        </div>

        <nav className="mt-4 flex gap-1 border-b border-slate-200">
          <Tab href="/admin/messages" icon="settings">
            準備をする
          </Tab>
          <Tab href="/admin/messages/log" icon="chat">
            ようすを見る
          </Tab>
        </nav>
      </header>

      {children}
    </div>
  );
}

function Tab({
  href,
  icon,
  children,
}: {
  href: string;
  icon: "settings" | "chat";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
    >
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </Link>
  );
}

function ConnectionChip({
  connected,
  error,
  label,
}: {
  connected: boolean;
  error: boolean;
  label: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-2 rounded-pill bg-bad-50 px-4 py-2 text-xs font-bold text-bad-700 ring-1 ring-inset ring-bad-100">
        <Icon name="alert" className="h-4 w-4" />
        つながりが切れています
      </span>
    );
  }
  if (connected) {
    return (
      <span className="inline-flex items-center gap-2 rounded-pill bg-good-50 px-4 py-2 text-xs font-bold text-good-700 ring-1 ring-inset ring-good-100">
        <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
        {label ? `${label} につながっています` : "つながっています"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
      <Icon name="clock" className="h-4 w-4" />
      まだつながっていません
    </span>
  );
}
