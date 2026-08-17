import { test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../src/lib/db.ts";
import { addMinutes, jst } from "../src/lib/time.ts";

/**
 * お店の側から入れる予約の確かめ。
 *
 * いちばん怖いのは二重予約。同じ時間に2件受けてしまうと、
 * 当日どちらかのお客様に迷惑がかかる。
 * サーバー処理はログインが要るので、重なり判定の条件そのものを確かめる。
 */

const DATE = "2026-09-01";

async function cleanup() {
  await prisma.reservationOption.deleteMany({ where: { reservation: { source: "owner-test" } } });
  await prisma.reservationLog.deleteMany({ where: { reservation: { source: "owner-test" } } });
  await prisma.reservation.deleteMany({ where: { source: "owner-test" } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: "__test__" } } });
  await prisma.menu.deleteMany({ where: { name: { startsWith: "__test__" } } });
}

async function fixtures() {
  await cleanup();
  // 他の確かめの残りに頼らない。自分で用意する。
  const staff = await prisma.staff.upsert({
    where: { id: "__test__owner" },
    create: { id: "__test__owner", name: "__test__オーナー", role: "owner" },
    update: {},
  });
  const menu = await prisma.menu.create({
    data: {
      category: "テスト",
      name: "__test__おそうじ",
      deliveryType: "visit",
      durationMinutes: 120,
      price: 10000,
    },
  });
  const customer = await prisma.customer.create({
    data: { name: "__test__電話のお客様", phone: "090-0000-0000", address: "東京都中央区銀座1-1" },
  });
  return { staff, menu, customer };
}

/** 重なり判定（booking-actions と同じ条件） */
async function findOverlap(staffId: string, start: Date, end: Date) {
  return prisma.reservation.findFirst({
    where: { staffId, status: "confirmed", startAt: { lt: end }, endAt: { gt: start } },
  });
}

test("LINEを使わないお客様を登録できる（lineUserIdが空でも入る）", async () => {
  const { customer } = await fixtures();
  assert.equal(customer.lineUserId, null);

  // 空どうしは重複と見なされないので、2人目も入る
  const another = await prisma.customer.create({
    data: { name: "__test__紹介のお客様", phone: "090-1111-1111" },
  });
  assert.equal(another.lineUserId, null);

  await cleanup();
});

test("同じ時間に重ねようとすると、重なりとして見つかる", async () => {
  const { staff, menu, customer } = await fixtures();

  const start = jst(DATE, "10:00");
  const end = addMinutes(start, 120);
  await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      startAt: start,
      endAt: end,
      totalMinutes: 120,
      totalPrice: 10000,
      status: "confirmed",
      deliveryType: "visit",
      source: "owner-test",
    },
  });

  // まるかぶり
  assert.ok(await findOverlap(staff.id, jst(DATE, "10:00"), addMinutes(jst(DATE, "10:00"), 120)));
  // 後ろが重なる
  assert.ok(await findOverlap(staff.id, jst(DATE, "11:00"), addMinutes(jst(DATE, "11:00"), 60)));
  // 前が重なる
  assert.ok(await findOverlap(staff.id, jst(DATE, "09:00"), addMinutes(jst(DATE, "09:00"), 90)));
  // すっぽり包む
  assert.ok(await findOverlap(staff.id, jst(DATE, "09:00"), addMinutes(jst(DATE, "09:00"), 240)));

  await cleanup();
});

test("隣り合っているだけなら、重なりにはしない", async () => {
  const { staff, menu, customer } = await fixtures();

  const start = jst(DATE, "10:00");
  await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      startAt: start,
      endAt: addMinutes(start, 120),
      totalMinutes: 120,
      totalPrice: 10000,
      status: "confirmed",
      deliveryType: "visit",
      source: "owner-test",
    },
  });

  // 12:00終わりの直後から
  assert.equal(await findOverlap(staff.id, jst(DATE, "12:00"), addMinutes(jst(DATE, "12:00"), 60)), null);
  // 10:00始まりの直前まで
  assert.equal(await findOverlap(staff.id, jst(DATE, "08:00"), addMinutes(jst(DATE, "08:00"), 120)), null);

  await cleanup();
});

test("取り消された予約は、重なりとして数えない", async () => {
  const { staff, menu, customer } = await fixtures();

  const start = jst(DATE, "10:00");
  await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      startAt: start,
      endAt: addMinutes(start, 120),
      totalMinutes: 120,
      totalPrice: 10000,
      status: "cancelled_by_customer",
      deliveryType: "visit",
      source: "owner-test",
    },
  });

  assert.equal(await findOverlap(staff.id, start, addMinutes(start, 120)), null);

  await cleanup();
  await prisma.$disconnect();
});
