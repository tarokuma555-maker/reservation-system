import test from "node:test";
import assert from "node:assert/strict";
import {
  parseReceipt,
  suggestAccountCode,
  isSmallAmountException,
  SAMPLE_RECEIPTS,
} from "../src/lib/ocr.ts";

/**
 * OCRで読み取った文字列の解析。
 * この処理は Vision API を使う場合もモックの場合も同じコードを通るため、
 * ここで守れていれば本番でも同じ挙動になる。
 */

test("ホームセンターのレシートから日付・金額・登録番号を読み取る", () => {
  const r = parseReceipt(SAMPLE_RECEIPTS.homecenter.text);
  assert.equal(r.transactionDate, "2026-08-10");
  assert.equal(r.totalAmount, 2640);
  assert.equal(r.registrationNumber, "T1234567890999");
  assert.equal(r.hasQualifiedInvoice, true);
  assert.match(r.vendorName, /カインズ/);
});

test("「合計」を「小計」より優先して拾う", () => {
  const r = parseReceipt(SAMPLE_RECEIPTS.gas.text);
  // 小計5,687ではなく合計6,255を採用する
  assert.equal(r.totalAmount, 6255);
});

test("スラッシュ区切りの日付も読み取れる", () => {
  const r = parseReceipt(SAMPLE_RECEIPTS.gas.text);
  assert.equal(r.transactionDate, "2026-08-12");
});

test("和暦（令和）の日付を西暦に変換する", () => {
  const r = parseReceipt(SAMPLE_RECEIPTS.training.text);
  assert.equal(r.transactionDate, "2026-08-05");
  assert.equal(r.totalAmount, 33000);
});

test("登録番号がないレシートはインボイスなしと判定される", () => {
  const r = parseReceipt(SAMPLE_RECEIPTS.parking.text);
  assert.equal(r.registrationNumber, null);
  assert.equal(r.hasQualifiedInvoice, false);
  assert.equal(r.totalAmount, 600);
});

test("税込1万円未満は少額特例の対象になり得る", () => {
  assert.equal(isSmallAmountException(600), true);
  assert.equal(isSmallAmountException(9999), true);
  assert.equal(isSmallAmountException(10000), false);
  assert.equal(isSmallAmountException(33000), false);
});

test("取引先から勘定科目を推定する", () => {
  assert.equal(suggestAccountCode(parseReceipt(SAMPLE_RECEIPTS.homecenter.text)), "5110"); // 消耗品費
  assert.equal(suggestAccountCode(parseReceipt(SAMPLE_RECEIPTS.gas.text)), "5140"); // 燃料費
  assert.equal(suggestAccountCode(parseReceipt(SAMPLE_RECEIPTS.parking.text)), "5150"); // 駐車場代
  assert.equal(suggestAccountCode(parseReceipt(SAMPLE_RECEIPTS.training.text)), "5200"); // 研修費
});

test("見出しがないレシートは最大の金額を合計とみなす", () => {
  const r = parseReceipt(["よろずや商店", "2026/07/01", "商品A 1,200", "商品B 3,400"].join("\n"));
  assert.equal(r.totalAmount, 3400);
});

test("読み取れない項目はnullで返し、後から手入力できるようにする", () => {
  const r = parseReceipt("かすれていて読めないレシート");
  assert.equal(r.transactionDate, null);
  assert.equal(r.registrationNumber, null);
});
