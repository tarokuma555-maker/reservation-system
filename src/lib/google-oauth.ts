/** Googleの確認画面から戻ってくる先。画面表示とサーバー処理で同じ値を使う。 */
export function googleRedirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/api/google/callback`;
}

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
