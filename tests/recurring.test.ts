/**
 * 定期予約のいちばん重要な性質を検証する。
 *   「個別に手を入れた回は、ルール変更で消えたり上書きされたりしない」
 *
 * 実際のDB（prisma/dev.db）に専用のデータを作って検証し、最後に片付ける。
 * 事前に `npm run db:push` が済んでいる必要がある。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { applyRuleChange, enumerateOccurrenceDates, generateOccurrences } from "../src/lib/recurring.ts";
import { addDays, todayStr } from "../src/lib/time.ts";

const prisma = new PrismaClient();
const TAG = "__test__";

async function cleanup() {
  const rules = await prisma.recurringRule.findMany({
    where: { customer: { lineUserId: { startsWith: TAG } } },
  });
  await prisma.reservation.deleteMany({ where: { recurringRuleId: { in: rules.map((r) => r.id) } } });
  await prisma.recurringRule.deleteMany({ where: { id: { in: rules.map((r) => r.id) } } });
  await prisma.reservation.deleteMany({ where: { customer: { lineUserId: { startsWith: TAG } } } });
  await prisma.customer.deleteMany({ where: { lineUserId: { startsWith: TAG } } });
  await prisma.menu.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.staff.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function setup() {
  await cleanup();
  const staff = await prisma.staff.create({ data: { name: `${TAG}スタッフ`, role: "owner" } });
  const customer = await prisma.customer.create({
    data: { lineUserId: `${TAG}${Date.now()}`, name: "テスト太郎", address: "東京都世田谷区1-1-1" },
  });
  const menu = await prisma.menu.create({
    data: {
      category: "テスト",
      name: `${TAG}定期おそうじ`,
      deliveryType: "visit",
      durationMinutes: 60,
      price: 11000,
      isRecurringOnly: true,
    },
  });
  return { staff, customer, menu };
}

test("毎週ルールから正しい間隔で実施日が列挙される", () => {
  const dates = enumerateOccurrenceDates(
    {
      frequency: "weekly",
      dayOfWeek: 2, // 火曜
      nthWeek: null,
      startDate: "2026-09-01", // 火曜
      endDate: null,
      pausedFrom: null,
      pausedTo: null,
    },
    "2026-09-01",
    "2026-09-30"
  );
  assert.deepEqual(dates, ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);
});

test("隔週ルールは1週おきになる", () => {
  const dates = enumerateOccurrenceDates(
    {
      frequency: "biweekly",
      dayOfWeek: 2,
      nthWeek: null,
      startDate: "2026-09-01",
      endDate: null,
      pausedFrom: null,
      pausedTo: null,
    },
    "2026-09-01",
    "2026-09-30"
  );
  assert.deepEqual(dates, ["2026-09-01", "2026-09-15", "2026-09-29"]);
});

test("毎月第2土曜のルールは月に1回だけ該当する", () => {
  const dates = enumerateOccurrenceDates(
    {
      frequency: "monthly_nth",
      dayOfWeek: 6,
      nthWeek: 2,
      startDate: "2026-09-01",
      endDate: null,
      pausedFrom: null,
      pausedTo: null,
    },
    "2026-09-01",
    "2026-11-30"
  );
  assert.deepEqual(dates, ["2026-09-12", "2026-10-10", "2026-11-14"]);
});

test("休止期間中の回は列挙されない", () => {
  const dates = enumerateOccurrenceDates(
    {
      frequency: "weekly",
      dayOfWeek: 2,
      nthWeek: null,
      startDate: "2026-09-01",
      endDate: null,
      pausedFrom: "2026-09-08",
      pausedTo: "2026-09-20",
    },
    "2026-09-01",
    "2026-09-30"
  );
  assert.deepEqual(dates, ["2026-09-01", "2026-09-22", "2026-09-29"]);
});

test("ルール変更をしても、個別に変更した回は消えない（いちばん重要）", async (t) => {
  const { staff, customer, menu } = await setup();
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const today = todayStr();
  const rule = await prisma.recurringRule.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      frequency: "weekly",
      dayOfWeek: 2,
      startTime: "10:00",
      durationMinutes: 60,
      startDate: today,
      status: "active",
    },
  });

  await generateOccurrences(rule.id, 60);

  const generated = await prisma.reservation.findMany({
    where: { recurringRuleId: rule.id },
    orderBy: { startAt: "asc" },
  });
  assert.ok(generated.length >= 4, "定期の回が生成されていること");

  // 3回目を「今回だけ日時変更した回」に見立てる
  const special = generated[2];
  await prisma.reservation.update({
    where: { id: special.id },
    data: { isException: true, internalNote: "今回だけ15時に変更" },
  });

  // 2回目を実施済みにする
  await prisma.reservation.update({
    where: { id: generated[1].id },
    data: { status: "completed" },
  });

  // 適用開始日を「今日」にしてルール条件を変更する
  const result = await applyRuleChange(rule.id, today, { dayOfWeek: 4, startTime: "14:00" });

  // 個別変更した回と実施済みの回は保護される
  assert.equal(result.protectedCount, 2, "保護対象が2件であること");

  const survived = await prisma.reservation.findUnique({ where: { id: special.id } });
  assert.ok(survived, "個別に変更した回が削除されていないこと");
  assert.equal(survived?.isException, true);

  const completed = await prisma.reservation.findUnique({ where: { id: generated[1].id } });
  assert.ok(completed, "実施済みの回が削除されていないこと");

  // 新条件（木曜14:00）で作り直されている
  const regenerated = await prisma.reservation.findMany({
    where: { recurringRuleId: rule.id, isException: false, status: "confirmed" },
  });
  assert.ok(regenerated.length > 0, "新しい条件で回が再生成されていること");
  for (const r of regenerated) {
    const jstTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(r.startAt);
    assert.equal(jstTime, "14:00", "再生成された回は新しい開始時刻になっていること");
  }
});

test("定期を終了すると、終了日より後の未実施分だけが削除される", async (t) => {
  const { staff, customer, menu } = await setup();
  t.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const today = todayStr();
  const rule = await prisma.recurringRule.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      frequency: "weekly",
      dayOfWeek: 3,
      startTime: "09:00",
      durationMinutes: 60,
      startDate: today,
      status: "active",
    },
  });
  await generateOccurrences(rule.id, 60);

  const before = await prisma.reservation.count({ where: { recurringRuleId: rule.id } });
  const { endRule } = await import("../src/lib/recurring.ts");
  await endRule(rule.id, addDays(today, 14));

  const after = await prisma.reservation.count({ where: { recurringRuleId: rule.id } });
  assert.ok(after < before, "終了日以降の回が削除されていること");
  assert.ok(after > 0, "終了日までの回は残っていること");

  const ended = await prisma.recurringRule.findUnique({ where: { id: rule.id } });
  assert.equal(ended?.status, "ended");
});
