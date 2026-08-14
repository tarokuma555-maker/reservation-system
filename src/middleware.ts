import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 管理画面はログインした人だけが開けるようにする。
 *
 * 中身の確認（この人が本当にスタッフか）はページ側で行う。ここでは
 * 「ログインの跡があるか」だけを見て、無ければログイン画面へ送る。
 * ミドルウェアは軽い処理しか置けないため、二段構えにしている。
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function middleware(req: NextRequest) {
  // ログインの仕組みが未設定のあいだ（開発中）は素通しする
  if (!process.env.AUTH_GOOGLE_ID) return NextResponse.next();

  const signedIn = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (signedIn) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
