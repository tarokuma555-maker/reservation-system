import { prisma } from "./db";

/**
 * デモのデータを消して、本番として使いはじめる。
 *
 * 消すのは「お客様とその取引の記録」だけ。
 * お店の設定・営業時間・ログインできる人・LINEとのつながり・出したメニューは残す。
 * これらは消すと使えなくなってしまい、入れ直す手間のほうが大きいため。
 *
 * 取り消しはできない。呼ぶ側で必ず確認を取ること。
 */

/**
 * 消す前に一字一句打ち込んでもらう言葉。
 * 押しまちがいでは絶対に通らない長さにしてある。
 */
export const CONFIRM_PHRASE = "デモのデータを消します";

export type DemoDataCounts = {
  customers: number;
  reservations: number;
  recurringRules: number;
  invoices: number;
  journalEntries: number;
  expenses: number;
  documents: number;
  menus: number;
};

export async function demoDataCounts(): Promise<DemoDataCounts> {
  const [
    customers,
    reservations,
    recurringRules,
    invoices,
    journalEntries,
    expenses,
    documents,
    menus,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.reservation.count(),
    prisma.recurringRule.count(),
    prisma.invoice.count(),
    prisma.journalEntry.count(),
    prisma.expense.count(),
    prisma.document.count(),
    prisma.menu.count(),
  ]);

  return {
    customers,
    reservations,
    recurringRules,
    invoices,
    journalEntries,
    expenses,
    documents,
    menus,
  };
}

/** デモのデータが入ったままかどうか。画面の出し分けに使う。 */
export async function isDemoData(): Promise<boolean> {
  const marker = await prisma.setting.findUnique({ where: { key: DEMO_MARKER_KEY } });
  return Boolean(marker);
}

const DEMO_MARKER_KEY = "demo_seeded_on";
const PRODUCTION_MARKER_KEY = "production_started_on";

export async function clearDemoData(options: { deleteMenus: boolean }): Promise<DemoDataCounts> {
  const before = await demoDataCounts();

  // 消す順番は、参照している側から。逆にすると外部キーで止まる。
  await prisma.documentLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.document.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.fixedAsset.deleteMany();
  await prisma.outboundMessage.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.calendarSync.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.reservationLog.deleteMany();
  await prisma.reservationOption.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.recurringRule.deleteMany();
  await prisma.blockedSlot.deleteMany();

  if (options.deleteMenus) {
    await prisma.menuOption.deleteMany();
    await prisma.menu.deleteMany();
  }

  await prisma.customer.deleteMany();

  // 「デモのまま」の印を外し、本番として使いはじめた日を残す
  await prisma.setting.deleteMany({ where: { key: DEMO_MARKER_KEY } });
  await prisma.setting.upsert({
    where: { key: PRODUCTION_MARKER_KEY },
    create: {
      key: PRODUCTION_MARKER_KEY,
      value: JSON.stringify({ startedAt: new Date().toISOString() }),
    },
    update: {},
  });

  return before;
}
