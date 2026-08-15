import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 管理画面はログインした人だけが開けるようにする。
 *
 * 中身の確認（この人が本当にスタッフか）はページ側で行う。ここでは
 * 「ログインの跡があるか」だけを見て、無ければログイン画面へ送る。
 * ミドルウェアは軽い処理しか置けないため、二段構えにしている。
 */

/**
 * ログインの跡として探すCookieの名前。
 *
 * 注意: 完全一致で探してはいけない。セッションが大きいとき、Auth.jsは
 * Cookieを `__Secure-authjs.session-token.0` `.1` … と分割して保存する。
 * Googleログインは載る情報が多く、実際に分割される。
 * 完全一致だとログイン済みでも見つけられず、ログイン画面に戻され続ける。
 */
const SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some((c) => SESSION_COOKIE_PREFIXES.some((p) => c.name === p || c.name.startsWith(`${p}.`)));
}

export function middleware(req: NextRequest) {
  // ログインの仕組みが未設定のあいだ（開発中）は素通しする
  if (!process.env.AUTH_GOOGLE_ID) return NextResponse.next();

  if (hasSessionCookie(req)) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
