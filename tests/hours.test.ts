import { test } from "node:test";
import assert from "node:assert/strict";

import { parseWeeklyHours, parseOnlineHours, isTime, isDate } from "../src/lib/hours.ts";

/**
 * 営業時間の入力チェック。
 *
 * ここを素通りさせると、決して埋まらない時間帯ができ、
 * お客様の予約画面から空きが消える。原因が分かりにくい壊れ方なので固定しておく。
 */

/** 画面から送られてくる値の代わり */
function form(values: Record<string, string>) {
  return (key: string) => values[key] ?? null;
}

/** 平日9-18時、土日休みの、ふつうの入力 */
function weekdays(): Record<string, string> {
  const v: Record<string, string> = { closed_0: "on", closed_6: "on" };
  for (let d = 1; d <= 5; d++) {
    v[`open_${d}`] = "09:00";
    v[`close_${d}`] = "18:00";
  }
  return v;
}

test("ふつうの入力は、7曜日ぶんそろえて返す", () => {
  const r = parseWeeklyHours(form(weekdays()));
  assert.ok("rows" in r);
  assert.equal(r.rows.length, 7);
  assert.equal(r.rows[0].isClosed, true);
  assert.equal(r.rows[1].openTime, "09:00");
  assert.equal(r.rows[6].isClosed, true);
});

test("終わりが始まりより前なら、その曜日を名指しで止める", () => {
  const v = weekdays();
  v.open_3 = "18:00";
  v.close_3 = "09:00";
  const r = parseWeeklyHours(form(v));
  assert.ok("error" in r);
  assert.match(r.error, /水曜日/);
});

test("同じ時刻どうしも止める（1分も受けられないため）", () => {
  const v = weekdays();
  v.open_2 = "10:00";
  v.close_2 = "10:00";
  const r = parseWeeklyHours(form(v));
  assert.ok("error" in r);
  assert.match(r.error, /火曜日/);
});

test("時間の形がおかしければ、書き方を示して止める", () => {
  const v = weekdays();
  v.open_1 = "9時";
  const r = parseWeeklyHours(form(v));
  assert.ok("error" in r);
  assert.match(r.error, /9:00 のような形/);
});

test("全部お休みは止める（予約を受けられなくなるため）", () => {
  const v: Record<string, string> = {};
  for (let d = 0; d <= 6; d++) v[`closed_${d}`] = "on";
  const r = parseWeeklyHours(form(v));
  assert.ok("error" in r);
  assert.match(r.error, /すべての曜日/);
});

test("お休みの曜日は、時間が空でも通る", () => {
  const v: Record<string, string> = { closed_0: "on" };
  for (let d = 1; d <= 6; d++) {
    v[`open_${d}`] = "10:00";
    v[`close_${d}`] = "19:00";
  }
  const r = parseWeeklyHours(form(v));
  assert.ok("rows" in r);
  assert.equal(r.rows[0].isClosed, true);
});

test("オンラインだけの時間も、同じ考え方で確かめる", () => {
  assert.ok("rows" in parseOnlineHours("20:00", "22:00", [1, 2, 3]));
  assert.ok("error" in parseOnlineHours("22:00", "20:00", [1]));
  assert.ok("error" in parseOnlineHours("20:00", "22:00", []));
  assert.ok("error" in parseOnlineHours("20時", "22:00", [1]));
});

test("時刻と日付の形の見分け", () => {
  assert.equal(isTime("00:00"), true);
  assert.equal(isTime("23:59"), true);
  assert.equal(isTime("24:00"), false);
  assert.equal(isTime("9:00"), false);
  assert.equal(isDate("2026-08-15"), true);
  assert.equal(isDate("2026/08/15"), false);
  assert.equal(isDate("2026-13-01"), false);
});
