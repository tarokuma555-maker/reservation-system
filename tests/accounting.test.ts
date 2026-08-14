/**
 * 会計エンジンの検証。
 * 実際のDB（prisma/dev.db）に専用の事業年度を作って検証し、最後に片付ける。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  buildConsumptionTaxSummary,
  buildFinancialStatements,
  createJournalEntry,
  ensureChartOfAccounts,
  fiscalYearRangeOf,
  postOpeningBalances,
  runDepreciation,
  trialBalance,
  UnbalancedJournalError,
} from "../src/lib/accounting.ts";

const prisma = new PrismaClient();

test("決算月から事業年度の期首・期末を求める（3月決算）", () => {
  assert.deepEqual(fiscalYearRangeOf("2026-08-14", 3), {
    startDate: "2026-04-01",
    endDate: "2027-03-31",
  });
  // 期末月のうちは前年開始の期に属する
  assert.deepEqual(fiscalYearRangeOf("2026-03-31", 3), {
    startDate: "2025-04-01",
    endDate: "2026-03-31",
  });
});

test("12月決算なら暦年と一致する", () => {
  assert.deepEqual(fiscalYearRangeOf("2026-08-14", 12), {
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
});

test("貸借が一致しない仕訳は保存できない", async (t) => {
  await ensureChartOfAccounts();
  t.after(async () => prisma.$disconnect());

  await assert.rejects(
    () =>
      createJournalEntry({
        entryDate: "2030-04-01",
        description: "テスト（不一致）",
        sourceType: "manual",
        lines: [
          { accountCode: "1010", side: "debit", amount: 1000 },
          { accountCode: "4010", side: "credit", amount: 900 },
        ],
      }),
    UnbalancedJournalError
  );
});

test("試算表・決算書・消費税集計が一貫している", async (t) => {
  await ensureChartOfAccounts();

  // テスト専用の事業年度を作る（既存のデモデータと混ざらないよう遠い将来にする）
  const fy = await prisma.fiscalYear.create({
    data: { name: "__test__2030年度", startDate: "2030-04-01", endDate: "2031-03-31" },
  });

  t.after(async () => {
    const entries = await prisma.journalEntry.findMany({ where: { fiscalYearId: fy.id } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: entries.map((e) => e.id) } } });
    await prisma.journalEntry.deleteMany({ where: { fiscalYearId: fy.id } });
    await prisma.fixedAsset.deleteMany({ where: { name: { startsWith: "__test__" } } });
    await prisma.fiscalYear.delete({ where: { id: fy.id } });
    await prisma.$disconnect();
  });

  // 期首残高
  await postOpeningBalances(fy.id, [
    { accountCode: "1020", debit: 1_000_000 },
    { accountCode: "3010", credit: 1_000_000 },
  ]);

  // 売上 110,000（税込）→ 税抜100,000 + 仮受消費税10,000
  await createJournalEntry({
    entryDate: "2030-06-01",
    description: "__test__売上",
    sourceType: "invoice",
    lines: [
      { accountCode: "1110", side: "debit", amount: 110_000 },
      { accountCode: "4010", side: "credit", amount: 100_000, taxCategory: "課税10", taxAmount: 10_000 },
      { accountCode: "2200", side: "credit", amount: 10_000 },
    ],
  });

  // 入金
  await createJournalEntry({
    entryDate: "2030-06-30",
    description: "__test__入金",
    sourceType: "payment",
    lines: [
      { accountCode: "1020", side: "debit", amount: 110_000 },
      { accountCode: "1110", side: "credit", amount: 110_000 },
    ],
  });

  // 経費 22,000（税込）インボイスあり → 税抜20,000 + 仮払消費税2,000
  await createJournalEntry({
    entryDate: "2030-07-10",
    description: "__test__経費（インボイスあり）",
    sourceType: "expense",
    lines: [
      { accountCode: "5110", side: "debit", amount: 20_000, taxCategory: "課税10", taxAmount: 2_000 },
      { accountCode: "2210", side: "debit", amount: 2_000, hasQualifiedInvoice: true },
      { accountCode: "1020", side: "credit", amount: 22_000 },
    ],
  });

  // 経費 11,000（税込）インボイスなし → 経過措置の対象
  await createJournalEntry({
    entryDate: "2030-07-20",
    description: "__test__経費（インボイスなし）",
    sourceType: "expense",
    lines: [
      { accountCode: "5160", side: "debit", amount: 10_000, taxCategory: "課税10", taxAmount: 1_000 },
      { accountCode: "2210", side: "debit", amount: 1_000, hasQualifiedInvoice: false },
      { accountCode: "1020", side: "credit", amount: 11_000 },
    ],
  });

  /* --- 試算表 --- */
  const tb = await trialBalance(fy.id);
  assert.equal(tb.balanced, true, "試算表の貸借が一致すること");

  /* --- 決算書 --- */
  const fs = await buildFinancialStatements(fy.id);
  assert.equal(fs.profitAndLoss.totalRevenue, 100_000);
  assert.equal(fs.profitAndLoss.totalExpense, 30_000);
  assert.equal(fs.profitAndLoss.netIncome, 70_000);
  assert.equal(
    fs.balanceSheet.balanced,
    true,
    `貸借対照表が一致すること（資産 ${fs.balanceSheet.totalAssets} / 負債+純資産 ${fs.balanceSheet.totalLiabilities + fs.balanceSheet.totalEquity}）`
  );

  // 株主資本等変動計算書の当期変動額は当期純利益と一致する
  const retained = fs.equityStatement.rows.find((r) => r.name === "繰越利益剰余金");
  assert.equal(retained?.change, 70_000);

  /* --- 消費税 --- */
  const tax = await buildConsumptionTaxSummary(fy.id);
  assert.equal(tax.outputTax, 10_000, "預かった消費税");
  assert.equal(tax.inputTaxQualified, 2_000, "インボイスありの仮払消費税");
  assert.equal(tax.inputTaxNonQualified, 1_000, "インボイスなしの仮払消費税");
  // 経過措置80% → 1,000 × 80% = 800
  assert.equal(tax.deductibleInputTax, 2_800);
  assert.equal(tax.honsokuPayable, 10_000 - 2_800);
  // 簡易課税（みなし仕入率50%）→ 10,000 - 5,000
  assert.equal(tax.kaniPayable, 5_000);
});

test("減価償却は定額法で計算され、同じ年度で二重計上されない", async (t) => {
  await ensureChartOfAccounts();

  const fy = await prisma.fiscalYear.create({
    data: { name: "__test__減価償却", startDate: "2031-04-01", endDate: "2032-03-31" },
  });
  const asset = await prisma.fixedAsset.create({
    data: {
      name: "__test__スチームクリーナー",
      acquisitionDate: "2030-04-01",
      acquisitionCost: 600_000,
      accountCode: "1500",
      usefulLife: 6,
    },
  });

  t.after(async () => {
    const entries = await prisma.journalEntry.findMany({ where: { fiscalYearId: fy.id } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: entries.map((e) => e.id) } } });
    await prisma.journalEntry.deleteMany({ where: { fiscalYearId: fy.id } });
    await prisma.fixedAsset.delete({ where: { id: asset.id } });
    await prisma.fiscalYear.delete({ where: { id: fy.id } });
    await prisma.$disconnect();
  });

  const first = await runDepreciation(fy.id);
  const mine = first.find((f) => f.asset === asset.name);
  // 600,000 ÷ 6年 = 100,000（期首から保有しているため12ヶ月分）
  assert.equal(mine?.amount, 100_000);

  const second = await runDepreciation(fy.id);
  assert.equal(
    second.find((f) => f.asset === asset.name),
    undefined,
    "同じ事業年度では二重に計上しないこと"
  );

  const after = await prisma.fixedAsset.findUniqueOrThrow({ where: { id: asset.id } });
  assert.equal(after.accumulatedDepreciation, 100_000);
});
