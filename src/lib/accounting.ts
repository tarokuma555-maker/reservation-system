import { prisma } from "./db";
import { getSettings } from "./settings";
import { calculateTax } from "./tax";
import { addDays, todayStr } from "./time";

/**
 * 複式簿記の会計エンジン。
 *
 * 予約・請求書・入金・経費といった業務上のできごとを仕訳に変換し、
 * 総勘定元帳・試算表・計算書類4表・消費税集計まで組み立てる。
 *
 * 金額はすべて円単位の整数。仕訳は必ず貸借が一致することを保存前に検証する。
 */

/* ---------------- 勘定科目マスタ ---------------- */

export const CHART_OF_ACCOUNTS: {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  taxCategory?: string;
  sortOrder: number;
}[] = [
  { code: "1010", name: "現金", type: "asset", sortOrder: 10 },
  { code: "1020", name: "普通預金", type: "asset", sortOrder: 20 },
  { code: "1110", name: "売掛金", type: "asset", sortOrder: 30 },
  { code: "1500", name: "工具器具備品", type: "asset", sortOrder: 40 },
  { code: "1590", name: "減価償却累計額", type: "asset", sortOrder: 50 },

  { code: "2010", name: "未払金", type: "liability", sortOrder: 110 },
  { code: "2110", name: "前受金", type: "liability", sortOrder: 120 },
  { code: "2200", name: "仮受消費税", type: "liability", sortOrder: 130 },
  { code: "2210", name: "仮払消費税", type: "asset", sortOrder: 60 },
  { code: "2300", name: "未払法人税等", type: "liability", sortOrder: 140 },

  { code: "3010", name: "資本金", type: "equity", sortOrder: 210 },
  { code: "3020", name: "繰越利益剰余金", type: "equity", sortOrder: 220 },

  { code: "4010", name: "売上高（家事代行）", type: "revenue", taxCategory: "課税10", sortOrder: 310 },
  { code: "4020", name: "売上高（片付けコンサル）", type: "revenue", taxCategory: "課税10", sortOrder: 320 },
  { code: "4090", name: "雑収入", type: "revenue", taxCategory: "課税10", sortOrder: 330 },

  { code: "5110", name: "消耗品費", type: "expense", taxCategory: "課税10", sortOrder: 410 },
  { code: "5120", name: "旅費交通費", type: "expense", taxCategory: "課税10", sortOrder: 420 },
  { code: "5130", name: "車両費", type: "expense", taxCategory: "課税10", sortOrder: 430 },
  { code: "5140", name: "燃料費", type: "expense", taxCategory: "課税10", sortOrder: 440 },
  { code: "5150", name: "駐車場代", type: "expense", taxCategory: "課税10", sortOrder: 450 },
  { code: "5160", name: "通信費", type: "expense", taxCategory: "課税10", sortOrder: 460 },
  { code: "5170", name: "水道光熱費", type: "expense", taxCategory: "課税10", sortOrder: 470 },
  { code: "5180", name: "地代家賃", type: "expense", taxCategory: "課税10", sortOrder: 480 },
  { code: "5190", name: "広告宣伝費", type: "expense", taxCategory: "課税10", sortOrder: 490 },
  { code: "5200", name: "研修費", type: "expense", taxCategory: "課税10", sortOrder: 500 },
  { code: "5210", name: "支払手数料", type: "expense", taxCategory: "課税10", sortOrder: 510 },
  { code: "5300", name: "外注費", type: "expense", taxCategory: "課税10", sortOrder: 520 },
  { code: "5400", name: "役員報酬", type: "expense", taxCategory: "不課税", sortOrder: 530 },
  { code: "5410", name: "法定福利費", type: "expense", taxCategory: "非課税", sortOrder: 540 },
  { code: "5500", name: "減価償却費", type: "expense", taxCategory: "対象外", sortOrder: 550 },
  { code: "5900", name: "租税公課", type: "expense", taxCategory: "対象外", sortOrder: 560 },
  { code: "6010", name: "法人税等", type: "expense", taxCategory: "対象外", sortOrder: 610 },
];

export async function ensureChartOfAccounts() {
  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        type: a.type,
        taxCategory: a.taxCategory ?? "対象外",
        sortOrder: a.sortOrder,
      },
      update: { name: a.name, type: a.type, sortOrder: a.sortOrder },
    });
  }
}

/* ---------------- 事業年度 ---------------- */

/** 決算月から、その日付が属する事業年度の期首・期末を求める */
export function fiscalYearRangeOf(dateStr: string, fiscalYearEndMonth: number) {
  const [y, m] = dateStr.split("-").map(Number);

  // まず「その日が属する期の期末」を決める。
  // 期末月を過ぎていれば翌年の期末、まだなら当年の期末に属する。
  const endYear = m <= fiscalYearEndMonth ? y : y + 1;
  const endDate = lastDayOf(endYear, fiscalYearEndMonth);

  // 期首は期末月の翌月。12月決算なら期首は同じ年の1月になる。
  const startMonth = (fiscalYearEndMonth % 12) + 1;
  const startYear = startMonth === 1 ? endYear : endYear - 1;
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;

  return { startDate, endDate };
}

function lastDayOf(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function ensureFiscalYear(dateStr = todayStr()) {
  const settings = await getSettings();
  const { startDate, endDate } = fiscalYearRangeOf(dateStr, settings.fiscalYearEndMonth);

  const existing = await prisma.fiscalYear.findFirst({ where: { startDate, endDate } });
  if (existing) return existing;

  return prisma.fiscalYear.create({
    data: { name: `${startDate.slice(0, 4)}年度（${startDate}〜${endDate}）`, startDate, endDate },
  });
}

/* ---------------- 仕訳 ---------------- */

export type JournalLineInput = {
  accountCode: string;
  side: "debit" | "credit";
  amount: number;
  taxCategory?: string;
  taxAmount?: number;
  hasQualifiedInvoice?: boolean;
  note?: string;
};

export class UnbalancedJournalError extends Error {
  constructor(debit: number, credit: number) {
    super(`仕訳の貸借が一致していません（借方 ${debit} / 貸方 ${credit}）`);
    this.name = "UnbalancedJournalError";
  }
}

export async function createJournalEntry(params: {
  entryDate: string;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  isAdjusting?: boolean;
  lines: JournalLineInput[];
}) {
  const debit = params.lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
  const credit = params.lines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);
  if (debit !== credit) throw new UnbalancedJournalError(debit, credit);
  if (debit === 0) throw new Error("金額が0の仕訳は作成できません");

  const fy = await ensureFiscalYear(params.entryDate);

  return prisma.journalEntry.create({
    data: {
      fiscalYearId: fy.id,
      entryDate: params.entryDate,
      description: params.description,
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      isAdjusting: params.isAdjusting ?? false,
      lines: {
        create: params.lines.map((l) => ({
          accountCode: l.accountCode,
          side: l.side,
          amount: l.amount,
          taxCategory: l.taxCategory ?? "対象外",
          taxAmount: l.taxAmount ?? 0,
          hasQualifiedInvoice: l.hasQualifiedInvoice ?? true,
          note: l.note ?? "",
        })),
      },
    },
    include: { lines: true },
  });
}

/** 請求書から売上の仕訳を起こす（発生主義。実施日で計上する） */
export async function journalizeInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: { include: { reservation: { include: { menu: true } } } }, customer: true },
  });

  const already = await prisma.journalEntry.findFirst({
    where: { sourceType: "invoice", sourceId: invoiceId },
  });
  if (already) return already;

  const settings = await getSettings();

  // 売上はメニューの種類で科目を分ける
  const byAccount = new Map<string, number>();
  for (const line of invoice.lines) {
    const category = line.reservation?.menu.category ?? "";
    const code = category.includes("コンサル") ? "4020" : "4010";
    byAccount.set(code, (byAccount.get(code) ?? 0) + line.amount);
  }

  const sign = invoice.type === "returned" ? -1 : 1;
  const lines: JournalLineInput[] = [];
  let totalTax = 0;
  let totalNet = 0;

  for (const [code, incTax] of byAccount) {
    const b = calculateTax(
      [{ description: "", transactionDate: invoice.issueDate, quantity: 1, unitPrice: incTax, taxRate: 10 }],
      settings.roundingMode
    );
    const net = b.subtotalByTaxRate[10] ?? 0;
    const tax = b.taxByTaxRate[10] ?? 0;
    totalNet += net;
    totalTax += tax;
    lines.push({
      accountCode: code,
      side: sign > 0 ? "credit" : "debit",
      amount: net,
      taxCategory: "課税10",
      taxAmount: tax,
    });
  }

  lines.push({
    accountCode: "2200", // 仮受消費税
    side: sign > 0 ? "credit" : "debit",
    amount: totalTax,
  });
  lines.push({
    accountCode: "1110", // 売掛金
    side: sign > 0 ? "debit" : "credit",
    amount: totalNet + totalTax,
  });

  return createJournalEntry({
    entryDate: invoice.lines[0]?.transactionDate ?? invoice.issueDate,
    description: `${invoice.recipientName} / ${invoice.invoiceNumber}`,
    sourceType: "invoice",
    sourceId: invoice.id,
    lines,
  });
}

/** 入金（現金受領・振込確認）の仕訳 */
export async function journalizePayment(params: {
  reservationId: string;
  date: string;
  amount: number;
  method: "cash" | "bank_transfer";
  customerName: string;
}) {
  const already = await prisma.journalEntry.findFirst({
    where: { sourceType: "payment", sourceId: params.reservationId },
  });
  if (already) return already;

  return createJournalEntry({
    entryDate: params.date,
    description: `${params.customerName} 入金（${params.method === "cash" ? "現金" : "振込"}）`,
    sourceType: "payment",
    sourceId: params.reservationId,
    lines: [
      { accountCode: params.method === "cash" ? "1010" : "1020", side: "debit", amount: params.amount },
      { accountCode: "1110", side: "credit", amount: params.amount },
    ],
  });
}

/** 経費の仕訳。インボイスの有無で仕入税額控除の可否が変わる。 */
export async function journalizeExpense(expenseId: string) {
  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id: expenseId },
    include: { account: true },
  });
  if (expense.journalEntryId) {
    return prisma.journalEntry.findUnique({ where: { id: expense.journalEntryId } });
  }

  const settings = await getSettings();
  const taxable = expense.taxCategory.startsWith("課税") || expense.taxCategory.startsWith("軽減");
  const rate = expense.taxCategory === "軽減8" ? 8 : 10;

  let net = expense.amount;
  let tax = 0;
  if (taxable) {
    const b = calculateTax(
      [
        {
          description: expense.vendorName,
          transactionDate: expense.expenseDate,
          quantity: 1,
          unitPrice: expense.amount,
          taxRate: rate,
        },
      ],
      settings.roundingMode
    );
    net = b.subtotalByTaxRate[rate] ?? expense.amount;
    tax = b.taxByTaxRate[rate] ?? 0;
  }

  const lines: JournalLineInput[] = [
    {
      accountCode: expense.accountCode,
      side: "debit",
      amount: net,
      taxCategory: expense.taxCategory,
      taxAmount: tax,
      hasQualifiedInvoice: expense.invoiceStatus !== "non_qualified",
    },
  ];
  if (tax > 0) {
    lines.push({
      accountCode: "2210", // 仮払消費税
      side: "debit",
      amount: tax,
      hasQualifiedInvoice: expense.invoiceStatus !== "non_qualified",
    });
  }
  lines.push({ accountCode: "1010", side: "credit", amount: expense.amount });

  const entry = await createJournalEntry({
    entryDate: expense.expenseDate,
    description: `${expense.vendorName} / ${expense.account.name}`,
    sourceType: "expense",
    sourceId: expense.id,
    lines,
  });

  await prisma.expense.update({ where: { id: expense.id }, data: { journalEntryId: entry.id } });
  return entry;
}

/* ---------------- 決算整理 ---------------- */

/** 減価償却（定額法）。事業年度に対応する償却額を計算して仕訳を起こす。 */
export async function runDepreciation(fiscalYearId: string) {
  const fy = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
  const assets = await prisma.fixedAsset.findMany({ where: { disposedAt: null } });

  const created = [];
  for (const asset of assets) {
    if (asset.acquisitionDate > fy.endDate) continue;

    const annual = Math.floor(asset.acquisitionCost / asset.usefulLife);
    // 取得初年度は月割り
    const months = monthsInFiscalYear(asset.acquisitionDate, fy.startDate, fy.endDate);
    const amount = Math.min(
      Math.floor((annual * months) / 12),
      asset.acquisitionCost - asset.accumulatedDepreciation
    );
    if (amount <= 0) continue;

    const already = await prisma.journalEntry.findFirst({
      where: { sourceType: "depreciation", sourceId: asset.id, fiscalYearId },
    });
    if (already) continue;

    const entry = await createJournalEntry({
      entryDate: fy.endDate,
      description: `減価償却（${asset.name}／定額法・耐用年数${asset.usefulLife}年）`,
      sourceType: "depreciation",
      sourceId: asset.id,
      isAdjusting: true,
      lines: [
        { accountCode: "5500", side: "debit", amount },
        { accountCode: "1590", side: "credit", amount },
      ],
    });

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: { accumulatedDepreciation: asset.accumulatedDepreciation + amount },
    });
    created.push({ asset: asset.name, amount, entryId: entry.id });
  }
  return created;
}

function monthsInFiscalYear(acquisitionDate: string, fyStart: string, fyEnd: string): number {
  const start = acquisitionDate > fyStart ? acquisitionDate : fyStart;
  if (start > fyEnd) return 0;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = fyEnd.split("-").map(Number);
  return Math.max(1, Math.min(12, (ey - sy) * 12 + (em - sm) + 1));
}

/* ---------------- 集計 ---------------- */

export type TrialBalanceRow = {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number; // 借方残高をプラスとする
};

export async function trialBalance(fiscalYearId: string): Promise<{
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}> {
  const entries = await prisma.journalEntry.findMany({
    where: { fiscalYearId },
    include: { lines: { include: { account: true } } },
  });

  const map = new Map<string, TrialBalanceRow>();
  for (const e of entries) {
    for (const l of e.lines) {
      const row =
        map.get(l.accountCode) ??
        {
          code: l.accountCode,
          name: l.account.name,
          type: l.account.type,
          debit: 0,
          credit: 0,
          balance: 0,
        };
      if (l.side === "debit") row.debit += l.amount;
      else row.credit += l.amount;
      row.balance = row.debit - row.credit;
      map.set(l.accountCode, row);
    }
  }

  const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export type FinancialStatements = {
  fiscalYear: { name: string; startDate: string; endDate: string };
  profitAndLoss: {
    revenues: { code: string; name: string; amount: number }[];
    expenses: { code: string; name: string; amount: number }[];
    totalRevenue: number;
    totalExpense: number;
    ordinaryIncome: number;
    corporateTax: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: { code: string; name: string; amount: number }[];
    liabilities: { code: string; name: string; amount: number }[];
    equity: { code: string; name: string; amount: number }[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    balanced: boolean;
  };
  equityStatement: {
    rows: { name: string; opening: number; change: number; closing: number }[];
  };
};

export async function buildFinancialStatements(fiscalYearId: string): Promise<FinancialStatements> {
  const fy = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
  const { rows } = await trialBalance(fiscalYearId);

  const pick = (type: string) => rows.filter((r) => r.type === type);

  const revenues = pick("revenue").map((r) => ({ code: r.code, name: r.name, amount: -r.balance }));
  const expensesAll = pick("expense").map((r) => ({ code: r.code, name: r.name, amount: r.balance }));

  const corporateTax = expensesAll.find((e) => e.code === "6010")?.amount ?? 0;
  const expenses = expensesAll.filter((e) => e.code !== "6010");

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const ordinaryIncome = totalRevenue - totalExpense;
  const netIncome = ordinaryIncome - corporateTax;

  // 貸借対照表。減価償却累計額は資産のマイナスとして扱う。
  const assets = pick("asset").map((r) => ({
    code: r.code,
    name: r.name,
    amount: r.code === "1590" ? r.balance : r.balance,
  }));
  const liabilities = pick("liability").map((r) => ({
    code: r.code,
    name: r.name,
    amount: -r.balance,
  }));
  const equityRows = pick("equity").map((r) => ({ code: r.code, name: r.name, amount: -r.balance }));

  // 当期純利益を繰越利益剰余金に振り替えたものが期末の純資産になる
  const equity = [...equityRows];
  const retained = equity.find((e) => e.code === "3020");
  if (retained) retained.amount += netIncome;
  else if (netIncome !== 0) equity.push({ code: "3020", name: "繰越利益剰余金", amount: netIncome });

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

  return {
    fiscalYear: { name: fy.name, startDate: fy.startDate, endDate: fy.endDate },
    profitAndLoss: {
      revenues,
      expenses,
      totalRevenue,
      totalExpense,
      ordinaryIncome,
      corporateTax,
      netIncome,
    },
    balanceSheet: {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanced: totalAssets === totalLiabilities + totalEquity,
    },
    equityStatement: {
      rows: [
        {
          name: "資本金",
          opening: equityRows.find((e) => e.code === "3010")?.amount ?? 0,
          change: 0,
          closing: equityRows.find((e) => e.code === "3010")?.amount ?? 0,
        },
        {
          name: "繰越利益剰余金",
          opening: equityRows.find((e) => e.code === "3020")?.amount ?? 0,
          change: netIncome,
          closing: (equityRows.find((e) => e.code === "3020")?.amount ?? 0) + netIncome,
        },
      ],
    },
  };
}

/* ---------------- 消費税 ---------------- */

export type ConsumptionTaxSummary = {
  taxableSalesExcludingTax: number;
  outputTax: number; // 仮受消費税
  inputTaxQualified: number; // インボイスあり
  inputTaxNonQualified: number; // インボイスなし（経過措置の対象）
  deductibleInputTax: number;
  honsokuPayable: number;
  kaniPayable: number;
  deemedPurchaseRate: number;
  transitionalRate: number;
  method: "honsoku" | "kani";
  payable: number;
};

export async function buildConsumptionTaxSummary(fiscalYearId: string): Promise<ConsumptionTaxSummary> {
  const settings = await getSettings();
  const entries = await prisma.journalEntry.findMany({
    where: { fiscalYearId },
    include: { lines: { include: { account: true } } },
  });

  let taxableSalesExcludingTax = 0;
  let outputTax = 0;
  let inputTaxQualified = 0;
  let inputTaxNonQualified = 0;

  for (const e of entries) {
    for (const l of e.lines) {
      if (l.account.type === "revenue" && l.taxCategory.startsWith("課税")) {
        taxableSalesExcludingTax += l.side === "credit" ? l.amount : -l.amount;
        outputTax += l.side === "credit" ? l.taxAmount : -l.taxAmount;
      }
      if (l.accountCode === "2210" && l.side === "debit") {
        if (l.hasQualifiedInvoice) inputTaxQualified += l.amount;
        else inputTaxNonQualified += l.amount;
      }
    }
  }

  // インボイスがない仕入れは経過措置の割合だけ控除できる
  const transitionalRate = settings.transitionalDeductionRate ?? 80;
  const deductibleInputTax =
    inputTaxQualified + Math.floor((inputTaxNonQualified * transitionalRate) / 100);

  // 簡易課税: サービス業は第五種（みなし仕入率50%）
  const deemedPurchaseRate = settings.deemedPurchaseRate ?? 50;

  const honsokuPayable = Math.max(0, outputTax - deductibleInputTax);
  const kaniPayable = Math.max(0, outputTax - Math.floor((outputTax * deemedPurchaseRate) / 100));

  return {
    taxableSalesExcludingTax,
    outputTax,
    inputTaxQualified,
    inputTaxNonQualified,
    deductibleInputTax,
    honsokuPayable,
    kaniPayable,
    deemedPurchaseRate,
    transitionalRate,
    method: settings.taxMethod,
    payable: settings.taxMethod === "kani" ? kaniPayable : honsokuPayable,
  };
}

/** 期首残高の登録（導入時の移行用） */
export async function postOpeningBalances(
  fiscalYearId: string,
  balances: { accountCode: string; debit?: number; credit?: number }[]
) {
  const fy = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } });
  const lines: JournalLineInput[] = balances.flatMap((b) => {
    const out: JournalLineInput[] = [];
    if (b.debit) out.push({ accountCode: b.accountCode, side: "debit", amount: b.debit });
    if (b.credit) out.push({ accountCode: b.accountCode, side: "credit", amount: b.credit });
    return out;
  });

  return createJournalEntry({
    entryDate: fy.startDate,
    description: "期首残高",
    sourceType: "manual",
    lines,
  });
}

export { addDays };
