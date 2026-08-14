import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTax,
  calculateTaxIncorrectly_DoNotUse,
  validateQualifiedInvoice,
  isReturnedInvoiceRequired,
  type TaxLine,
} from "../src/lib/tax.ts";

const line = (unitPrice: number, taxRate = 10): TaxLine => ({
  description: "おそうじ基本プラン",
  transactionDate: "2026-08-20",
  quantity: 1,
  unitPrice,
  taxRate,
});

test("税率ごとに1回だけ端数処理する（要件定義 付録C の例）", () => {
  // 税込 13,580 + 4,980 = 18,560
  // 18,560 × 10 / 110 = 1,687.27… → 切捨て → 1,687
  const result = calculateTax([line(13580), line(4980)], "floor");

  assert.equal(result.totalAmount, 18560);
  assert.equal(result.taxByTaxRate[10], 1687);
  assert.equal(result.subtotalByTaxRate[10], 16873);
  assert.equal(result.subtotalAmount + result.taxAmount, result.totalAmount);
});

test("明細ごとに端数処理する誤った計算とは結果が異なる", () => {
  const lines = [line(13580), line(4980)];

  const correct = calculateTax(lines, "floor").taxAmount;
  const incorrect = calculateTaxIncorrectly_DoNotUse(lines, "floor");

  // 1,687 と 1,686 で1円ずれる。この差が積み上がると帳簿が合わなくなる。
  assert.equal(correct, 1687);
  assert.equal(incorrect, 1686);
  assert.notEqual(correct, incorrect);
});

test("税抜と消費税の合計が必ず税込と一致する", () => {
  const amounts = [13200, 9900, 8800, 6600, 4400, 19800, 12100, 2750, 3300, 5500];
  for (const a of amounts) {
    const r = calculateTax([line(a)], "floor");
    assert.equal(
      r.subtotalByTaxRate[10] + r.taxByTaxRate[10],
      a,
      `税込 ${a} の内訳が一致しません`
    );
  }
});

test("複数税率が混ざっても税率ごとに分けて計算する", () => {
  const result = calculateTax([line(13580, 10), line(4980, 8)], "floor");

  assert.equal(result.taxByTaxRate[10], Math.floor((13580 * 10) / 110)); // 1234
  assert.equal(result.taxByTaxRate[8], Math.floor((4980 * 8) / 108)); // 368
  assert.equal(result.totalAmount, 18560);
});

test("端数処理の方法を切上げ・四捨五入に変えられる", () => {
  const lines = [line(13580), line(4980)];
  assert.equal(calculateTax(lines, "floor").taxAmount, 1687);
  assert.equal(calculateTax(lines, "ceil").taxAmount, 1688);
  assert.equal(calculateTax(lines, "round").taxAmount, 1687);
});

test("数量が複数でも税込単価×数量で集計される", () => {
  const r = calculateTax([{ ...line(8800), quantity: 3 }], "floor");
  assert.equal(r.totalAmount, 26400);
  assert.equal(r.taxByTaxRate[10], 2400);
});

test("法定6項目がそろっていれば検証を通る", () => {
  const lines = [line(13200)];
  const errors = validateQualifiedInvoice({
    issuerName: "株式会社くらしのて",
    registrationNumber: "T1234567890123",
    recipientName: "佐藤 美咲 様",
    lines,
    breakdown: calculateTax(lines),
  });
  assert.deepEqual(errors, []);
});

test("登録番号の形式が不正なら発行できない", () => {
  const lines = [line(13200)];
  const errors = validateQualifiedInvoice({
    issuerName: "株式会社くらしのて",
    registrationNumber: "1234567890123", // T がない
    recipientName: "佐藤 美咲 様",
    lines,
    breakdown: calculateTax(lines),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /登録番号/);
});

test("宛名が空なら発行できない", () => {
  const lines = [line(13200)];
  const errors = validateQualifiedInvoice({
    issuerName: "株式会社くらしのて",
    registrationNumber: "T1234567890123",
    recipientName: "",
    lines,
    breakdown: calculateTax(lines),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /宛名/);
});

test("返還インボイスは税込1万円未満なら交付義務が免除される", () => {
  assert.equal(isReturnedInvoiceRequired(9999), false);
  assert.equal(isReturnedInvoiceRequired(10000), true);
  assert.equal(isReturnedInvoiceRequired(13200), true);
});
