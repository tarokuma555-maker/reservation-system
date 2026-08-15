import { cache } from "react";
import { prisma } from "./db";

export type DeliveryType = "visit" | "online";

/**
 * デモ用の仮置き設定。
 * 実運用では管理画面（/admin/settings）から変更する想定で、値はすべて Setting テーブルに保存する。
 * 「まだ決まっていない項目」はここの既定値がそのまま使われる。
 */
export type AppSettings = {
  // 事業者情報（インボイス）
  issuerName: string;
  registrationNumber: string; // T + 13桁
  issuerAddress: string;
  fiscalYearEndMonth: number; // 決算月
  taxMethod: "honsoku" | "kani"; // 本則課税 / 簡易課税
  simplifiedBusinessType: string; // 簡易課税の事業区分
  roundingMode: "floor" | "ceil" | "round"; // 消費税の端数処理
  invoiceNumberPrefix: string;
  /** 簡易課税のみなし仕入率（第五種＝サービス業は50%） */
  deemedPurchaseRate: number;
  /** インボイスがない仕入れの控除割合（経過措置）。改正で変わるため設定値で持つ */
  transitionalDeductionRate: number;
  /** 少額特例（税込1万円未満は帳簿の保存のみで控除可）を使うか */
  smallAmountExceptionEnabled: boolean;

  // 拠点（オンラインの実施場所であり、訪問との往復の基準点）
  baseAddress: string;

  // 移動時間バッファ（分）: 前の予約の形態 → 次の予約の形態
  travelBuffer: {
    visit_visit: number;
    visit_online: number;
    online_visit: number;
    online_online: number;
  };

  // 準備・片付けバッファ（分）
  prepBeforeMinutes: number;
  prepAfterMinutes: number;

  // 受付ルール
  cutoffHours: { visit: number; online: number }; // 受付締切（時間前）
  bookingWindowDays: number; // 何日先まで予約可能か
  maxPerDay: { visit: number; online: number };
  slotGranularityMinutes: number;

  // 対応エリア（訪問のみ適用）
  serviceAreas: string[];

  // キャンセルポリシー（時間前 → キャンセル料率%）
  cancelPolicy: { hoursBefore: number; feeRate: number; selfServiceAllowed: boolean }[];
  recurringSkipFreeDays: number; // 定期のスキップが無料になる日数

  // 通知
  reminderTimeBeforeDays: number;
  reminderHour: number; // 前日リマインドの送信時刻
  onlineReminderMinutes: number; // オンライン開始前リマインド

  // 間取り別の所要時間補正（訪問のみ）
  layoutAdjustMinutes: Record<string, number>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  issuerName: "株式会社くらしのて（仮）",
  registrationNumber: "T1234567890123", // 仮の登録番号
  issuerAddress: "東京都世田谷区○○1-2-3",
  fiscalYearEndMonth: 3,
  taxMethod: "kani",
  simplifiedBusinessType: "第五種事業（サービス業）",
  roundingMode: "floor",
  invoiceNumberPrefix: "2026",
  deemedPurchaseRate: 50,
  transitionalDeductionRate: 80,
  smallAmountExceptionEnabled: true,

  baseAddress: "東京都世田谷区○○1-2-3",

  travelBuffer: {
    visit_visit: 60,
    visit_online: 60,
    online_visit: 60,
    online_online: 15,
  },

  prepBeforeMinutes: 15,
  prepAfterMinutes: 15,

  cutoffHours: { visit: 24, online: 3 },
  bookingWindowDays: 90,
  maxPerDay: { visit: 3, online: 2 },
  slotGranularityMinutes: 30,

  serviceAreas: ["世田谷区", "目黒区", "渋谷区", "杉並区", "中野区"],

  cancelPolicy: [
    { hoursBefore: 48, feeRate: 0, selfServiceAllowed: true },
    { hoursBefore: 24, feeRate: 50, selfServiceAllowed: true },
    { hoursBefore: 0, feeRate: 100, selfServiceAllowed: false },
  ],
  recurringSkipFreeDays: 3,

  reminderTimeBeforeDays: 1,
  reminderHour: 18,
  onlineReminderMinutes: 15,

  layoutAdjustMinutes: { "1LDK以下": 0, "2LDK": 30, "3LDK以上": 60 },
};

const SETTINGS_KEY = "app_settings";

/**
 * 設定の読み出し。
 *
 * 1回の画面表示で、枠組み・見出し・中身からそれぞれ呼ばれる。
 * cache() で包むと、同じ表示のあいだは1回しかデータベースに行かない。
 * データベースが遠い（海外）ほど効く。
 */
export const getSettings = cache(async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

/** 前の予約の形態 → 次の予約の形態 で必要な移動バッファ（分）を返す */
export function travelBufferMinutes(
  settings: AppSettings,
  from: DeliveryType,
  to: DeliveryType
): number {
  const key = `${from}_${to}` as keyof AppSettings["travelBuffer"];
  return settings.travelBuffer[key];
}

/** キャンセル時点での料率と、顧客自身が操作できるかを返す */
export function resolveCancelPolicy(settings: AppSettings, hoursUntilStart: number) {
  const sorted = [...settings.cancelPolicy].sort((a, b) => b.hoursBefore - a.hoursBefore);
  for (const p of sorted) {
    if (hoursUntilStart >= p.hoursBefore) return p;
  }
  return sorted[sorted.length - 1];
}
