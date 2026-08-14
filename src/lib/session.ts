import { cookies } from "next/headers";
import { prisma } from "./db";

export const DEMO_CUSTOMER_COOKIE = "demo_customer_id";

/**
 * デモでは LIFF のログインの代わりに、Cookie で「いまLINEを操作している顧客」を切り替える。
 * 本番では liff.getIDToken() を検証して LINEユーザーID を得る。
 */
export async function getCurrentCustomer() {
  const store = await cookies();
  const id = store.get(DEMO_CUSTOMER_COOKIE)?.value;

  if (id) {
    const found = await prisma.customer.findUnique({ where: { id } });
    if (found) return found;
  }
  return prisma.customer.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getOwner() {
  const staff = await prisma.staff.findFirst({ where: { role: "owner" } });
  if (!staff) throw new Error("スタッフが登録されていません。npm run db:reset を実行してください。");
  return staff;
}
