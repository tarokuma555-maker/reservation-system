import { prisma } from "./db";
import { getSettings } from "./settings";
import { addDays, addMinutes, dayOfWeekOfDateStr, jst, toDateStr, now } from "./time";

export type Frequency = "weekly" | "biweekly" | "every4weeks" | "monthly_nth";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "毎週",
  biweekly: "隔週",
  every4weeks: "4週ごと",
  monthly_nth: "毎月第N曜日",
};

/**
 * 定期ルールから、指定期間に該当する実施日（YYYY-MM-DD）を列挙する。
 * ルール自体は「繰り返しの定義」であり、各回はここで実体化される。
 */
export function enumerateOccurrenceDates(
  rule: {
    frequency: string;
    dayOfWeek: number;
    nthWeek: number | null;
    startDate: string;
    endDate: string | null;
    pausedFrom: string | null;
    pausedTo: string | null;
  },
  fromDate: string,
  toDate: string
): string[] {
  const results: string[] = [];
  const hardEnd = rule.endDate && rule.endDate < toDate ? rule.endDate : toDate;

  let cursor = rule.startDate > fromDate ? rule.startDate : fromDate;

  // 開始日から見て最初の該当曜日まで進める
  let guard = 0;
  while (dayOfWeekOfDateStr(cursor) !== rule.dayOfWeek && guard++ < 7) {
    cursor = addDays(cursor, 1);
  }

  while (cursor <= hardEnd && results.length < 400) {
    if (matchesFrequency(rule, cursor) && !isPaused(rule, cursor)) {
      results.push(cursor);
    }
    cursor = addDays(cursor, 7);
  }

  return results;
}

function matchesFrequency(
  rule: { frequency: string; startDate: string; nthWeek: number | null },
  dateStr: string
): boolean {
  if (rule.frequency === "weekly") return true;

  if (rule.frequency === "monthly_nth") {
    const day = Number(dateStr.split("-")[2]);
    const nth = Math.floor((day - 1) / 7) + 1;
    return nth === (rule.nthWeek ?? 1);
  }

  // 隔週・4週ごとは、開始日からの経過週数で判定する
  const weeks = weeksBetween(rule.startDate, dateStr);
  if (rule.frequency === "biweekly") return weeks % 2 === 0;
  if (rule.frequency === "every4weeks") return weeks % 4 === 0;
  return true;
}

function weeksBetween(a: string, b: string): number {
  const days = Math.round((jst(b, "12:00").getTime() - jst(a, "12:00").getTime()) / 86_400_000);
  return Math.floor(days / 7);
}

function isPaused(rule: { pausedFrom: string | null; pausedTo: string | null }, dateStr: string): boolean {
  if (!rule.pausedFrom || !rule.pausedTo) return false;
  return dateStr >= rule.pausedFrom && dateStr <= rule.pausedTo;
}

/**
 * 定期ルールの各回を実体化する（先行 generateDays 日分）。
 * 既に存在する回は作り直さないので、何度呼んでも安全。
 */
export async function generateOccurrences(ruleId: string, generateDays = 90) {
  const rule = await prisma.recurringRule.findUnique({
    where: { id: ruleId },
    include: { menu: true, customer: true },
  });
  if (!rule || rule.status === "ended") return { created: 0, conflicts: [] as string[] };

  const settings = await getSettings();
  const today = toDateStr(now());
  const until = addDays(today, generateDays);

  const dates = enumerateOccurrenceDates(rule, today, until);

  const existing = await prisma.reservation.findMany({
    where: { recurringRuleId: rule.id },
    select: { occurrenceDate: true },
  });
  const existingDates = new Set(existing.map((e) => e.occurrenceDate));

  let created = 0;
  const conflicts: string[] = [];

  for (const date of dates) {
    if (existingDates.has(date)) continue;

    const start = jst(date, rule.startTime);
    const end = addMinutes(start, rule.durationMinutes);

    // 同じスタッフの既存予約と重なっていないかだけ確認する（移動バッファは管理画面で調整）
    const overlap = await prisma.reservation.findFirst({
      where: {
        staffId: rule.staffId,
        status: { in: ["confirmed", "completed"] },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      include: { customer: true },
    });

    if (overlap) {
      conflicts.push(`${date} は ${overlap.customer.name}様の予約と重なるため作成しませんでした`);
      continue;
    }

    await prisma.reservation.create({
      data: {
        customerId: rule.customerId,
        staffId: rule.staffId,
        menuId: rule.menuId,
        recurringRuleId: rule.id,
        occurrenceDate: date,
        startAt: start,
        endAt: end,
        totalMinutes: rule.durationMinutes,
        totalPrice: rule.menu.price,
        deliveryType: rule.menu.deliveryType,
        serviceAddress:
          rule.menu.deliveryType === "visit"
            ? [rule.customer.address, rule.customer.buildingName].filter(Boolean).join(" ")
            : null,
        meetingUrl:
          rule.menu.deliveryType === "online"
            ? `https://meet.google.com/demo-${rule.id.slice(0, 4)}-${date.replace(/-/g, "")}`
            : null,
        status: "confirmed",
        source: "line",
      },
    });
    created++;
  }

  await prisma.recurringRule.update({
    where: { id: rule.id },
    data: { generatedUntil: until },
  });

  void settings;
  return { created, conflicts };
}

/**
 * ルールの条件を変更し、適用開始日以降の未実施分だけを作り直す。
 *
 * 保護対象（作り直さないもの）:
 *   - 実施済み（completed）
 *   - 適用開始日より前の回
 *   - 個別に手を入れた回（isException = true）
 * → 「今回だけ日時変更した回」がルール変更で消えてしまう事故を防ぐ。
 */
export async function applyRuleChange(
  ruleId: string,
  effectiveFrom: string,
  patch: {
    frequency?: string;
    dayOfWeek?: number;
    nthWeek?: number | null;
    startTime?: string;
    durationMinutes?: number;
    menuId?: string;
    endDate?: string | null;
  }
) {
  const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error("定期ルールが見つかりません");

  // 1. 再生成対象を削除（保護対象は残す）
  const target = await prisma.reservation.findMany({
    where: {
      recurringRuleId: ruleId,
      status: "confirmed",
      isException: false,
      occurrenceDate: { gte: effectiveFrom },
    },
  });

  const protectedCount = await prisma.reservation.count({
    where: {
      recurringRuleId: ruleId,
      occurrenceDate: { gte: effectiveFrom },
      OR: [{ isException: true }, { status: "completed" }],
    },
  });

  for (const r of target) {
    await prisma.reservationLog.create({
      data: {
        reservationId: r.id,
        actorType: "system",
        action: "ルール変更にともなう再生成のため削除",
        detail: `適用開始日 ${effectiveFrom}`,
      },
    });
  }
  await prisma.reservation.deleteMany({ where: { id: { in: target.map((t) => t.id) } } });

  // 2. ルールを更新
  await prisma.recurringRule.update({ where: { id: ruleId }, data: patch });

  // 3. 新条件で再生成
  const result = await generateOccurrences(ruleId);

  return { deleted: target.length, protectedCount, ...result };
}

/** 定期を終了する（終了日以降の未実施分を削除し、それまでの実績は残す） */
export async function endRule(ruleId: string, endDate: string) {
  const removed = await prisma.reservation.deleteMany({
    where: {
      recurringRuleId: ruleId,
      status: "confirmed",
      occurrenceDate: { gt: endDate },
    },
  });
  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { status: "ended", endDate },
  });
  return removed.count;
}

/** 一時休止（期間内の回を削除し、再開後は自動で継続する） */
export async function pauseRule(ruleId: string, from: string, to: string) {
  const removed = await prisma.reservation.deleteMany({
    where: {
      recurringRuleId: ruleId,
      status: "confirmed",
      isException: false,
      occurrenceDate: { gte: from, lte: to },
    },
  });
  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { status: "paused", pausedFrom: from, pausedTo: to },
  });
  return removed.count;
}

export async function resumeRule(ruleId: string) {
  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { status: "active", pausedFrom: null, pausedTo: null },
  });
  return generateOccurrences(ruleId);
}
