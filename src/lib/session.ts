import { cookies } from "next/headers";
import { prisma } from "./db";
import { getLineCredentials } from "./line";
import { LIFF_SESSION_COOKIE, readLiffSession } from "./liff-auth";

export const DEMO_CUSTOMER_COOKIE = "demo_customer_id";

/**
 * いまお客様側の画面を見ている人を特定する。
 *
 * LIFFの設定が入っていれば「本番」とみなし、**確認できた人しか通さない**。
 * 分からなければ null を返し、画面には「LINEから開いてください」と出す。
 *
 * かつてここは、分からないときに最初のお客様を返していた。
 * デモでは便利だったが、本番でそれをやると
 * お客様が別のお客様の氏名・住所・電話番号を見てしまう。
 */
export async function getCurrentCustomer() {
  const store = await cookies();
  const credentials = await getLineCredentials();
  const live = Boolean(credentials?.liffId);

  // 本番（LIFFの設定あり）: 署名を確かめた合いことばだけを信じる
  if (live) {
    const customerId = readLiffSession(store.get(LIFF_SESSION_COOKIE)?.value);
    if (!customerId) return null;
    return prisma.customer.findUnique({ where: { id: customerId } });
  }

  // つなぎこみ前の確認用。切替で「誰として見るか」を選べる。
  const id = store.get(DEMO_CUSTOMER_COOKIE)?.value;
  if (id) {
    const found = await prisma.customer.findUnique({ where: { id } });
    if (found) return found;
  }
  return prisma.customer.findFirst({ orderBy: { createdAt: "asc" } });
}

/** お客様側の画面が「本番の見分け方」で動いているか */
export async function isLiffLive(): Promise<boolean> {
  const credentials = await getLineCredentials();
  return Boolean(credentials?.liffId);
}

export async function getOwner() {
  const staff = await prisma.staff.findFirst({ where: { role: "owner" } });
  if (!staff) throw new Error("スタッフが登録されていません。npm run db:seed を実行してください。");
  return staff;
}
