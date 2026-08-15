import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createLiffSession,
  LIFF_SESSION_COOKIE,
  LIFF_SESSION_MAX_AGE,
  verifyLiffIdToken,
} from "@/lib/liff-auth";

export const dynamic = "force-dynamic";

/**
 * LINEから受け取った証明を確かめて、お客様を特定する受け口。
 *
 * ブラウザから送られてくる情報は信用せず、必ずLINEに問い合わせて確かめる。
 * 確認できたら、こちらで署名した合いことばをCookieに入れて返す。
 */
export async function POST(req: NextRequest) {
  let idToken: string | undefined;
  try {
    const body = (await req.json()) as { idToken?: string };
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ ok: false, error: "内容を読み取れませんでした" }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ ok: false, error: "証明がありません" }, { status: 400 });
  }

  const verified = await verifyLiffIdToken(idToken);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 401 });
  }

  const { lineUserId, displayName, pictureUrl } = verified.user;

  // 初めての方は、その場でお客様として登録する。
  // お名前はLINEの表示名を借りておき、あとから管理画面で直せる。
  const customer = await prisma.customer.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      name: displayName?.trim() || "お名前未設定",
      pictureUrl: pictureUrl ?? null,
      tags: "新規",
    },
    update: {
      ...(displayName?.trim() ? { name: displayName.trim() } : {}),
      ...(pictureUrl ? { pictureUrl } : {}),
    },
  });

  const res = NextResponse.json({ ok: true, name: customer.name });
  res.cookies.set(LIFF_SESSION_COOKIE, createLiffSession(customer.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: LIFF_SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
