import { test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../src/lib/db.ts";
import { clearDemoData, demoDataCounts, isDemoData } from "../src/lib/reset.ts";

/**
 * デモのデータを消す操作の確かめ。
 *
 * ここでいちばん怖いのは「消しすぎ」。ログインできる人やお店の設定まで
 * 消えてしまうと、消したあと誰も管理画面に入れなくなる。
 */

const DEMO_MARKER = "demo_seeded_on";
const PRODUCTION_MARKER = "production_started_on";

async function seedMinimal() {
  await prisma.setting.deleteMany({ where: { key: { in: [DEMO_MARKER, PRODUCTION_MARKER] } } });
  // お客様にぶら下がるものを、関係の深い順に片づけてからにする。
  // 領収書の控えが残るようになったぶん、ここも先に消さないとお客様を消せない。
  await prisma.documentLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.document.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.reservationLog.deleteMany();
  await prisma.reservationOption.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();

  await prisma.setting.create({
    data: { key: DEMO_MARKER, value: JSON.stringify({ seededOn: "2026-01-01" }) },
  });

  const staff = await prisma.staff.upsert({
    where: { id: "reset-test-staff" },
    create: { id: "reset-test-staff", name: "テスト担当", role: "owner" },
    update: {},
  });

  const customer = await prisma.customer.create({
    data: { name: "架空 太郎", phone: "090-0000-0000", lineUserId: `U-reset-test-${Date.now()}` },
  });

  return { staff, customer };
}

test("デモのデータを消すと、お客様とご予約は消える", async () => {
  const { customer } = await seedMinimal();

  const before = await demoDataCounts();
  assert.ok(before.customers >= 1, "消す前にお客様がいること");

  await clearDemoData({ deleteMenus: false });

  const after = await demoDataCounts();
  assert.equal(after.customers, 0);
  assert.equal(after.reservations, 0);
  assert.equal(after.invoices, 0);
  assert.equal(await prisma.customer.findUnique({ where: { id: customer.id } }), null);
});

test("消したあとも、ログインできる人とお店の設定は残る", async () => {
  const { staff } = await seedMinimal();

  await prisma.setting.upsert({
    where: { key: "app_settings" },
    create: { key: "app_settings", value: JSON.stringify({ issuerName: "残るはず" }) },
    update: { value: JSON.stringify({ issuerName: "残るはず" }) },
  });

  await clearDemoData({ deleteMenus: false });

  const stillThere = await prisma.staff.findUnique({ where: { id: staff.id } });
  assert.ok(stillThere, "ログインできる人が消えてはいけない");

  const settings = await prisma.setting.findUnique({ where: { key: "app_settings" } });
  assert.ok(settings, "お店の設定が消えてはいけない");
});

test("メニューを残す指定なら、料金メニューは消えない", async () => {
  await seedMinimal();

  const menu = await prisma.menu.create({
    data: {
      category: "テスト",
      name: "テスト用メニュー",
      deliveryType: "online",
      durationMinutes: 60,
      price: 5000,
    },
  });

  await clearDemoData({ deleteMenus: false });
  assert.ok(await prisma.menu.findUnique({ where: { id: menu.id } }), "残す指定なら残る");

  await clearDemoData({ deleteMenus: true });
  assert.equal(await prisma.menu.findUnique({ where: { id: menu.id } }), null, "消す指定なら消える");
});

test("消したあとは「デモのまま」の印が外れ、二度と入れ直されない", async () => {
  await seedMinimal();
  assert.equal(await isDemoData(), true);

  await clearDemoData({ deleteMenus: false });

  assert.equal(await isDemoData(), false);
  const marker = await prisma.setting.findUnique({ where: { key: PRODUCTION_MARKER } });
  assert.ok(marker, "本番として使いはじめた印が残ること");

  // この印があるかぎり、デプロイのたびの自動投入は動かない
  const { ensureInitialData } = await import("../src/lib/demo-seed.ts");
  const result = await ensureInitialData();
  assert.equal(result.seeded, false);
});
