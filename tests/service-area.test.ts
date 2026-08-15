import { test } from "node:test";
import assert from "node:assert/strict";

import { visitEligibility, isServiceableArea } from "../src/lib/availability.ts";
import { DEFAULT_SETTINGS } from "../src/lib/settings.ts";

/**
 * 訪問できるかどうかの見分け。
 *
 * 「住所がまだ無い」を「エリア外」と一緒くたにすると、LINEから来られたばかりの
 * お客様全員が、登録すれば使えるのに追い返される。実際にそうなっていた。
 */

const settings = { ...DEFAULT_SETTINGS, serviceAreas: ["世田谷区", "目黒区"] };

test("住所がまだ無い方は「エリア外」ではなく「未登録」として扱う", () => {
  assert.equal(visitEligibility(settings, "visit", null), "no_address");
  assert.equal(visitEligibility(settings, "visit", undefined), "no_address");
  assert.equal(visitEligibility(settings, "visit", ""), "no_address");
  // 空白だけの住所も、入っていないのと同じ
  assert.equal(visitEligibility(settings, "visit", "   "), "no_address");
});

test("エリア内の住所なら訪問できる", () => {
  assert.equal(visitEligibility(settings, "visit", "東京都世田谷区北沢1-2-3"), "ok");
  assert.equal(visitEligibility(settings, "visit", "東京都目黒区中目黒4-5-6"), "ok");
});

test("エリア外の住所は、未登録とは別に扱う", () => {
  assert.equal(visitEligibility(settings, "visit", "北海道札幌市中央区1-1"), "out_of_area");
});

test("よその市の同じ名前の区を、東京の区と取り違えない", () => {
  // 「中央区」「港区」は政令指定都市にいくつもある。
  // 文字が含まれるかだけで見ると、うかがえない土地の予約が通ってしまう。
  const tokyo = { ...DEFAULT_SETTINGS, serviceAreas: ["中央区", "江東区", "港区"] };

  assert.equal(visitEligibility(tokyo, "visit", "東京都中央区銀座1-1"), "ok");
  assert.equal(visitEligibility(tokyo, "visit", "東京都港区六本木1-1"), "ok");
  assert.equal(visitEligibility(tokyo, "visit", "東京都江東区豊洲1-1"), "ok");

  assert.equal(visitEligibility(tokyo, "visit", "北海道札幌市中央区南1条1-1"), "out_of_area");
  assert.equal(visitEligibility(tokyo, "visit", "大阪府大阪市中央区本町1-1"), "out_of_area");
  assert.equal(visitEligibility(tokyo, "visit", "大阪府大阪市港区市岡1-1"), "out_of_area");
  assert.equal(visitEligibility(tokyo, "visit", "愛知県名古屋市港区港町1-1"), "out_of_area");
  assert.equal(visitEligibility(tokyo, "visit", "千葉県千葉市中央区中央1-1"), "out_of_area");
});

test("都道府県まで書いた設定でも、そのまま一致する", () => {
  const explicit = { ...DEFAULT_SETTINGS, serviceAreas: ["東京都中央区", "東京都港区"] };
  assert.equal(visitEligibility(explicit, "visit", "東京都中央区銀座1-1"), "ok");
  assert.equal(visitEligibility(explicit, "visit", "大阪府大阪市中央区本町1-1"), "out_of_area");
});

test("都道府県を省いて書かれた住所も受け付ける", () => {
  const tokyo = { ...DEFAULT_SETTINGS, serviceAreas: ["中央区", "江東区", "港区"] };
  assert.equal(visitEligibility(tokyo, "visit", "中央区銀座1-1"), "ok");
});

test("オンラインは住所に関わらず、どこからでも受けられる", () => {
  assert.equal(visitEligibility(settings, "online", null), "ok");
  assert.equal(visitEligibility(settings, "online", "北海道札幌市中央区1-1"), "ok");
});

test("これまでの判定（真偽値）も、意味が変わっていない", () => {
  assert.equal(isServiceableArea(settings, "visit", null), false);
  assert.equal(isServiceableArea(settings, "visit", "東京都世田谷区北沢1-2-3"), true);
  assert.equal(isServiceableArea(settings, "visit", "北海道札幌市中央区1-1"), false);
  assert.equal(isServiceableArea(settings, "online", null), true);
});
