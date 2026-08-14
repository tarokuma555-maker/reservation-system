import { prisma } from "./db";

/**
 * リクエスト文脈（Cookie）に依存しないスタッフ取得。
 * バッチ処理やWebhookからも呼べるようにしている。
 */
export async function getOwnerStaffId(): Promise<string> {
  const staff = await prisma.staff.findFirst({ where: { role: "owner" } });
  if (!staff) throw new Error("スタッフが登録されていません。npm run db:reset を実行してください。");
  return staff.id;
}
