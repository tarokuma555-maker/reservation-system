/**
 * 消費税の計算。要件定義 付録C の実装。
 *
 * 重要な決まりごと:
 *   1. 金額は円単位の整数のみで扱う（浮動小数点数を使わない）
 *   2. メニュー料金は税込で保持する（消費者向けは総額表示が義務のため）
 *   3. 端数処理は「1つの請求書につき、税率ごとに1回だけ」行う
 *      → 明細行ごとに端数処理して合計する実装は認められていない
 */

export type RoundingMode = "floor" | "ceil" | "round";

export type TaxLine = {
  description: string;
  transactionDate: string; // YYYY-MM-DD
  quantity: number;
  unitPrice: number; // 税込単価
  taxRate: number; // 10 | 8
  isReducedTaxRate?: boolean;
  reservationId?: string | null;
};

export type TaxBreakdown = {
  /** 税率 → 税抜合計 */
  subtotalByTaxRate: Record<number, number>;
  /** 税率 → 消費税額 */
  taxByTaxRate: Record<number, number>;
  /** 税率 → 税込合計 */
  totalByTaxRate: Record<number, number>;
  /** 税込総額 */
  totalAmount: number;
  /** 税抜総額 */
  subtotalAmount: number;
  /** 消費税総額 */
  taxAmount: number;
};

export function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case "ceil":
      return Math.ceil(value);
    case "round":
      return Math.round(value);
    case "floor":
    default:
      return Math.floor(value);
  }
}

/**
 * 税込金額の集合から、税率ごとの内訳を求める。
 *
 * ★ここが実装上いちばん重要な箇所★
 * 税率ごとに税込金額を合計してから、1回だけ端数処理する。
 * 明細ごとに端数処理してから足し合わせると1円ずれ、交付したインボイスが
 * 要件を満たさなくなる（受け取った側が仕入税額控除を受けられない）。
 */
export function calculateTax(lines: TaxLine[], mode: RoundingMode = "floor"): TaxBreakdown {
  // 1. 税率ごとに税込金額を合計する（この時点では端数処理をしない）
  const totalByTaxRate: Record<number, number> = {};
  for (const line of lines) {
    const amount = line.unitPrice * line.quantity;
    totalByTaxRate[line.taxRate] = (totalByTaxRate[line.taxRate] ?? 0) + amount;
  }

  // 2. 税率ごとに1回だけ端数処理する
  const subtotalByTaxRate: Record<number, number> = {};
  const taxByTaxRate: Record<number, number> = {};
  for (const [rateStr, incTaxTotal] of Object.entries(totalByTaxRate)) {
    const rate = Number(rateStr);
    const rawTax = (incTaxTotal * rate) / (100 + rate);
    const tax = applyRounding(rawTax, mode);
    taxByTaxRate[rate] = tax;
    subtotalByTaxRate[rate] = incTaxTotal - tax;
  }

  const totalAmount = Object.values(totalByTaxRate).reduce((a, b) => a + b, 0);
  const taxAmount = Object.values(taxByTaxRate).reduce((a, b) => a + b, 0);

  return {
    subtotalByTaxRate,
    taxByTaxRate,
    totalByTaxRate,
    totalAmount,
    subtotalAmount: totalAmount - taxAmount,
    taxAmount,
  };
}

/**
 * 参考: 誤った計算方法（明細行ごとに端数処理する）。
 * 比較テストのためだけに置いている。本番コードからは絶対に呼ばないこと。
 */
export function calculateTaxIncorrectly_DoNotUse(
  lines: TaxLine[],
  mode: RoundingMode = "floor"
): number {
  return lines.reduce((sum, line) => {
    const amount = line.unitPrice * line.quantity;
    return sum + applyRounding((amount * line.taxRate) / (100 + line.taxRate), mode);
  }, 0);
}

/** 適格請求書の法定6項目がそろっているかを検証する */
export type InvoiceValidationInput = {
  issuerName: string;
  registrationNumber: string;
  recipientName: string;
  lines: TaxLine[];
  breakdown: TaxBreakdown;
};

export function validateQualifiedInvoice(input: InvoiceValidationInput): string[] {
  const errors: string[] = [];

  if (!input.issuerName.trim()) {
    errors.push("① 発行事業者の名称が設定されていません");
  }
  if (!/^T\d{13}$/.test(input.registrationNumber.trim())) {
    errors.push("① 登録番号が「T + 数字13桁」の形式ではありません");
  }
  if (input.lines.length === 0) {
    errors.push("③ 取引内容がありません（明細が空です）");
  }
  if (input.lines.some((l) => !/^\d{4}-\d{2}-\d{2}$/.test(l.transactionDate))) {
    errors.push("② 取引年月日が入っていない明細があります");
  }
  if (input.lines.some((l) => !l.description.trim())) {
    errors.push("③ 取引内容が空の明細があります");
  }
  if (Object.keys(input.breakdown.subtotalByTaxRate).length === 0) {
    errors.push("④ 税率ごとの対価の額が算出されていません");
  }
  if (Object.keys(input.breakdown.taxByTaxRate).length === 0) {
    errors.push("⑤ 税率ごとの消費税額が算出されていません");
  }
  if (!input.recipientName.trim()) {
    errors.push("⑥ 宛名（交付を受ける事業者の氏名または名称）が空です");
  }

  return errors;
}

/** 適格返還請求書の交付義務（税込1万円未満は免除） */
export const RETURNED_INVOICE_THRESHOLD = 10_000;

export function isReturnedInvoiceRequired(returnedAmountIncludingTax: number): boolean {
  return returnedAmountIncludingTax >= RETURNED_INVOICE_THRESHOLD;
}
