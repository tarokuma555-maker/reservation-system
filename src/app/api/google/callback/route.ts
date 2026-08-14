import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { saveConnection } from "@/lib/connections";
import { exchangeCodeForRefreshToken } from "@/lib/google-calendar";
import { googleRedirectUri, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/**
 * Googleの確認画面から戻ってくる先。
 *
 * ここで受け取る「引換券（code）」を、ずっと使えるリフレッシュトークンに交換して保存する。
 * デモではこの交換を手作業でやっていた部分。
 */
export async function GET(req: NextRequest) {
  const back = (params: Record<string, string>) => {
    const url = new URL("/admin/calendar-sync", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  const staff = await requireStaff().catch(() => null);
  if (!staff) return back({ connected: "no", reason: "ログインし直してからおためしください" });

  const store = await cookies();
  const raw = store.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  store.delete(GOOGLE_OAUTH_STATE_COOKIE);

  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return back({
      connected: "no",
      reason:
        error === "access_denied"
          ? "許可されなかったため、つながっていません。もう一度おためしください。"
          : `Googleからの返事: ${error}`,
    });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !raw) {
    return back({ connected: "no", reason: "手続きの途中で情報が失われました。もう一度どうぞ。" });
  }

  let saved: { state: string; clientId: string; clientSecret: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return back({ connected: "no", reason: "手続きの情報が読めませんでした。もう一度どうぞ。" });
  }

  // 自分が始めた手続きか確かめる（他人に勝手に繋がされるのを防ぐ）
  if (saved.state !== state) {
    return back({ connected: "no", reason: "手続きの確認に失敗しました。もう一度どうぞ。" });
  }

  const result = await exchangeCodeForRefreshToken({
    clientId: saved.clientId,
    clientSecret: saved.clientSecret,
    redirectUri: googleRedirectUri(),
    code,
  });

  if (!result.ok) return back({ connected: "no", reason: result.error });

  await saveConnection({
    provider: "google_calendar",
    credentials: {
      clientId: saved.clientId,
      clientSecret: saved.clientSecret,
      refreshToken: result.refreshToken,
    },
    label: "Googleカレンダー",
    actorName: staff.name,
  });

  return back({ connected: "yes" });
}
