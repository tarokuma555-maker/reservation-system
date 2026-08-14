import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "./db";

/**
 * 管理画面のログイン。
 *
 * お客様のお名前・ご住所・お電話番号をお預かりする画面なので、
 * 誰でも開ける状態にはしない。Googleアカウントでログインし、
 * かつ Staff に登録されているメールアドレスの人だけが入れる。
 *
 * ここで求めるのは「あなたが誰か」だけ。カレンダーを読み書きする許可は
 * 別の画面で改めてお願いする（ログインのたびに重い確認画面を出さないため）。
 */

/** 最初の管理者。環境変数に書いたアドレスは、初回ログイン時に自動で登録される。 */
function bootstrapEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** ログインを許すかどうかを決め、許すなら Staff を用意して返す */
export async function resolveStaffForEmail(email: string | null | undefined) {
  if (!email) return null;
  const normalized = email.toLowerCase();

  const existing = await prisma.staff.findUnique({ where: { email: normalized } });
  if (existing) {
    if (!existing.isActive) return null;
    return existing;
  }

  // まだ誰も登録されていない立ち上げ時だけ、環境変数のアドレスを受け入れる
  if (!bootstrapEmails().includes(normalized)) return null;

  const owner = await prisma.staff.findFirst({ where: { role: "owner", email: null } });
  if (owner) {
    return prisma.staff.update({ where: { id: owner.id }, data: { email: normalized } });
  }
  return prisma.staff.create({
    data: { name: normalized.split("@")[0], email: normalized, role: "owner" },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // ログインでは身元だけを確認する。カレンダーの許可はここでは求めない。
      authorization: { params: { scope: "openid email profile", prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async signIn({ profile }) {
      const staff = await resolveStaffForEmail(profile?.email);
      if (!staff) return false;
      await prisma.staff.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date() },
      });
      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.email) {
        const staff = await resolveStaffForEmail(profile.email);
        if (staff) {
          token.staffId = staff.id;
          token.staffName = staff.name;
          token.staffRole = staff.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.staffId) {
        session.user = {
          ...session.user,
          id: token.staffId as string,
          name: (token.staffName as string) ?? session.user?.name,
          role: (token.staffRole as string) ?? "staff",
        };
      }
      return session;
    },
  },
});

/** ログインの仕組みが使える状態か。未設定なら設定画面で案内する。 */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/**
 * いま操作している人。管理画面の処理はすべてこれを通す。
 * ログインの仕組みが未設定のうち（開発中）は、オーナーとして扱う。
 */
export async function currentStaff() {
  if (!isAuthConfigured()) {
    return prisma.staff.findFirst({ where: { role: "owner" } });
  }
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.staff.findUnique({ where: { id } });
}

/** 管理操作の入口で必ず呼ぶ。ログインしていなければ例外にする。 */
export async function requireStaff() {
  const staff = await currentStaff();
  if (!staff) throw new Error("ログインが必要です");
  return staff;
}
