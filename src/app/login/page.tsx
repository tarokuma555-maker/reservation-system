import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { auth, isAuthConfigured } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const ERROR_MESSAGE: Record<string, string> = {
  AccessDenied:
    "このGoogleアカウントでは入れません。管理画面に登録されているアカウントでお試しください。",
  Configuration: "ログインの設定がまだ終わっていません。少しお待ちください。",
  Verification: "確認用のリンクの有効期限が切れています。もう一度おためしください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const settings = await getSettings();

  const session = await auth();
  if (session?.user?.id) redirect(next ?? "/admin");

  const configured = isAuthConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ground-warm px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-card border border-slate-200/80 bg-surface p-8 shadow-lift">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-sheen text-white">
              <Icon name="sparkle" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-snug text-ink">
                {settings.issuerName}
              </p>
              <p className="text-2xs text-slate-500">管理画面</p>
            </div>
          </div>

          <h1 className="mt-6 text-xl font-extrabold tracking-tighter text-ink">
            ログインしてください
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            お客様のお名前やご住所をお預かりしている画面です。
            ご本人だけが開けるように、Googleアカウントで確認させていただきます。
          </p>

          {error ? (
            <div className="mt-4 flex gap-2.5 rounded-card border border-bad-100 bg-bad-50 px-4 py-3">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" />
              <p className="text-xs leading-relaxed text-bad-700">
                {ERROR_MESSAGE[error] ?? "ログインできませんでした。もう一度おためしください。"}
              </p>
            </div>
          ) : null}

          {configured ? (
            <form
              className="mt-6"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: next ?? "/admin" });
              }}
            >
              <button className="flex w-full items-center justify-center gap-2.5 rounded-pill border border-slate-200 bg-surface py-3 text-sm font-bold text-slate-700 shadow-card transition hover:border-brand-300 hover:text-brand-700">
                <GoogleMark />
                Googleアカウントでログイン
              </button>
            </form>
          ) : (
            <div className="mt-6 flex gap-2.5 rounded-card border border-warn-100 bg-warn-50 px-4 py-3">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
              <p className="text-xs leading-relaxed text-warn-700">
                ログインの準備がまだ終わっていません。準備が済むまでは、
                管理画面はどなたでも開ける状態です。
              </p>
            </div>
          )}

          <p className="mt-5 border-t border-slate-100 pt-4 text-2xs leading-relaxed text-slate-500">
            パスワードは使いません。Googleの画面で確認するだけなので、
            覚えておく合いことばはありません。
          </p>
        </div>
      </div>
    </main>
  );
}

/** Googleの色そのままのマーク。ここだけは公式の見た目に合わせる決まりになっている。 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
