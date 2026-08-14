/**
 * Googleカレンダー同期の検証（モックモード）。
 * 「システム側を正とし、Google側で消されたら復元する」という方針が守られているかを確認する。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  deleteReservationFromCalendar,
  detectAndRepairDrift,
  importPersonalEventsAsBlocks,
  syncReservationToCalendar,
} from "../src/lib/google-calendar.ts";
import { addMinutes, jst, addDays, todayStr } from "../src/lib/time.ts";

const prisma = new PrismaClient();
const TAG = "__cal_test__";

async function cleanup() {
  const customers = await prisma.customer.findMany({
    where: { lineUserId: { startsWith: TAG } },
  });
  const ids = customers.map((c) => c.id);
  const reservations = await prisma.reservation.findMany({ where: { customerId: { in: ids } } });
  await prisma.calendarSync.deleteMany({ where: { reservationId: { in: reservations.map((r) => r.id) } } });
  await prisma.calendarEvent.deleteMany({ where: { googleEventId: { contains: TAG } } });
  await prisma.blockedSlot.deleteMany({ where: { googleEventId: { contains: TAG } } });
  await prisma.reservation.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  await prisma.menu.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.staff.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function setup(deliveryType: "visit" | "online") {
  const staff =
    (await prisma.staff.findFirst({ where: { role: "owner" } })) ??
    (await prisma.staff.create({ data: { name: `${TAG}スタッフ`, role: "owner" } }));
  const customer = await prisma.customer.create({
    data: { lineUserId: `${TAG}${Date.now()}`, name: "カレンダー太郎", address: "東京都世田谷区9-9-9" },
  });
  const menu = await prisma.menu.create({
    data: {
      category: "テスト",
      name: `${TAG}メニュー`,
      deliveryType,
      durationMinutes: 60,
      price: 11000,
    },
  });
  const start = jst(addDays(todayStr(), 10), "10:00");
  const reservation = await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      startAt: start,
      endAt: addMinutes(start, 60),
      totalMinutes: 60,
      totalPrice: 11000,
      status: "confirmed",
      deliveryType,
      serviceAddress: deliveryType === "visit" ? "東京都世田谷区9-9-9" : null,
    },
  });
  return { reservation };
}

test("予約を書き出すとイベントが作られ、reservationIdが埋め込まれる", async (t) => {
  await cleanup();
  const { reservation } = await setup("visit");
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const result = await syncReservationToCalendar(reservation.id);
  assert.equal(result.status, "synced");

  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { googleEventId: result.googleEventId! },
  });
  assert.equal(event.privateReservationId, reservation.id, "システム作成イベントの印が付いていること");
  assert.match(event.summary, /カレンダー太郎/);
  assert.equal(event.location, "東京都世田谷区9-9-9");

  const sync = await prisma.calendarSync.findUniqueOrThrow({
    where: { reservationId: reservation.id },
  });
  assert.equal(sync.syncStatus, "synced");
});

test("オンラインの予約はMeetのURLが発行され、予約に書き戻される", async (t) => {
  await cleanup();
  const { reservation } = await setup("online");
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const result = await syncReservationToCalendar(reservation.id);
  assert.ok(result.meetUrl?.startsWith("https://meet.google.com/"), "会議URLが発行されること");

  const updated = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
  assert.equal(updated.meetingUrl, result.meetUrl, "予約側にもURLが保存されること");
});

test("Google側で消されたイベントは、システム側を正として復元される", async (t) => {
  await cleanup();
  const { reservation } = await setup("visit");
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const first = await syncReservationToCalendar(reservation.id);

  // Google側で手動削除された状況を作る
  await prisma.calendarEvent.update({
    where: { googleEventId: first.googleEventId! },
    data: { isDeleted: true },
  });

  const repair = await detectAndRepairDrift();
  assert.ok(repair.repaired.includes(reservation.id), "復元対象に含まれること");

  const restored = await prisma.calendarEvent.findUniqueOrThrow({
    where: { googleEventId: first.googleEventId! },
  });
  assert.equal(restored.isDeleted, false, "イベントが復元されていること");
});

test("キャンセルした予約はGoogle側からも消え、復元もされない", async (t) => {
  await cleanup();
  const { reservation } = await setup("visit");
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const first = await syncReservationToCalendar(reservation.id);
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: "cancelled_by_customer" },
  });
  await deleteReservationFromCalendar(reservation.id);

  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { googleEventId: first.googleEventId! },
  });
  assert.equal(event.isDeleted, true);

  const repair = await detectAndRepairDrift();
  assert.equal(
    repair.repaired.includes(reservation.id),
    false,
    "キャンセル済みの予約は復元しないこと"
  );
});

test("私用予定だけがブロック枠として取り込まれる（システム作成分は除外）", async (t) => {
  await cleanup();
  const { reservation } = await setup("visit");
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  await syncReservationToCalendar(reservation.id);

  const personalStart = jst(addDays(todayStr(), 11), "13:00");
  await prisma.calendarEvent.create({
    data: {
      googleEventId: `${TAG}_personal`,
      summary: "通院",
      startAt: personalStart,
      endAt: addMinutes(personalStart, 90),
      source: "personal",
    },
  });

  const result = await importPersonalEventsAsBlocks(
    jst(todayStr(), "00:00"),
    jst(addDays(todayStr(), 30), "00:00")
  );

  assert.ok(result.skipped >= 1, "システムが作ったイベントは取り込まないこと");

  const block = await prisma.blockedSlot.findFirst({ where: { googleEventId: `${TAG}_personal` } });
  assert.ok(block, "私用予定はブロック枠になること");
  assert.equal(block?.title, "通院");
  assert.equal(block?.source, "google");
});
