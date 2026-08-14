import { prisma } from "./db";
import { AppSettings, DeliveryType, getSettings, travelBufferMinutes } from "./settings";
import {
  addMinutes,
  dayOfWeekOfDateStr,
  diffMinutes,
  jst,
  minutesToTime,
  now,
  timeToMinutes,
  toDateStr,
} from "./time";

export type Slot = {
  time: string; // "10:00"
  start: Date;
  end: Date;
  available: boolean;
  reason?: string; // 空いていない理由（管理画面のデバッグ表示用）
};

/** 予約が占有する時間帯（準備・片付けバッファを含む） */
type Occupied = {
  start: Date;
  end: Date;
  deliveryType: DeliveryType | null; // null = ブロック枠（移動の概念なし）
  label: string;
};

export type AvailabilityInput = {
  dateStr: string;
  durationMinutes: number;
  deliveryType: DeliveryType;
  staffId: string;
  /** 変更のときに、自分自身の予約は障害物から除外する */
  excludeReservationId?: string;
};

/**
 * 指定日の空き枠を計算する。
 *
 * 判定する条件（要件定義 5.1.4）:
 *   - 営業時間内（提供形態別の受付時間帯にも対応）
 *   - 休業日でない
 *   - 既存予約・ブロック枠と重ならない
 *   - 前後の予約との間に、提供形態の組み合わせに応じた移動バッファがある ★
 *   - 受付締切を過ぎていない（形態別）
 *   - 予約可能期間内
 *   - その日の受注件数上限を超えない（形態別）
 */
export async function getAvailableSlots(input: AvailabilityInput): Promise<Slot[]> {
  const settings = await getSettings();
  const { dateStr, durationMinutes, deliveryType, staffId } = input;

  const dow = dayOfWeekOfDateStr(dateStr);

  // 休業日
  const holiday = await prisma.holiday.findFirst({ where: { date: dateStr } });
  if (holiday) return [];

  // 予約可能期間
  const today = toDateStr(now());
  if (dateStr < today) return [];
  const limit = new Date(now().getTime() + settings.bookingWindowDays * 86_400_000);
  if (dateStr > toDateStr(limit)) return [];

  // 営業時間（提供形態別の指定があればそれを優先し、なければ共通設定を使う）
  const hours = await prisma.businessHour.findMany({
    where: { dayOfWeek: dow, OR: [{ staffId }, { staffId: null }] },
  });
  const applicable = hours.filter(
    (h) => !h.isClosed && (h.deliveryType === null || h.deliveryType === deliveryType)
  );
  if (applicable.length === 0) return [];

  // 既存予約とブロック枠
  const dayStart = jst(dateStr, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const windowStart = addMinutes(dayStart, -12 * 60); // 前日夜の予約も移動バッファの計算に効く
  const windowEnd = addMinutes(dayEnd, 12 * 60);

  const reservations = await prisma.reservation.findMany({
    where: {
      staffId,
      status: { in: ["confirmed", "completed"] },
      startAt: { gte: windowStart, lt: windowEnd },
      ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
    },
    include: { menu: true, customer: true },
  });

  const blocked = await prisma.blockedSlot.findMany({
    where: { staffId, startAt: { gte: windowStart, lt: windowEnd } },
  });

  const occupied: Occupied[] = [
    ...reservations.map((r) => ({
      start: addMinutes(r.startAt, -settings.prepBeforeMinutes),
      end: addMinutes(r.endAt, settings.prepAfterMinutes),
      deliveryType: r.deliveryType as DeliveryType,
      label: `${r.customer.name}様 / ${r.menu.name}`,
    })),
    ...blocked.map((b) => ({
      start: b.startAt,
      end: b.endAt,
      deliveryType: null,
      label: b.title || "ブロック枠",
    })),
  ];

  // その日の受注件数の上限（形態別）
  const sameDayCount = reservations.filter(
    (r) => toDateStr(r.startAt) === dateStr && r.deliveryType === deliveryType
  ).length;
  const overDailyLimit = sameDayCount >= settings.maxPerDay[deliveryType];

  // 受付締切
  const cutoff = new Date(now().getTime() + settings.cutoffHours[deliveryType] * 3_600_000);

  const slots: Slot[] = [];
  const granularity = settings.slotGranularityMinutes;

  for (const h of applicable) {
    const open = timeToMinutes(h.openTime);
    const close = timeToMinutes(h.closeTime);
    for (let m = open; m + durationMinutes <= close; m += granularity) {
      const time = minutesToTime(m);
      const start = jst(dateStr, time);
      const end = addMinutes(start, durationMinutes);

      let available = true;
      let reason: string | undefined;

      if (overDailyLimit) {
        available = false;
        reason = `1日の${deliveryType === "visit" ? "訪問" : "オンライン"}受注上限（${settings.maxPerDay[deliveryType]}件）に達しています`;
      } else if (start < cutoff) {
        available = false;
        reason = `受付締切（${settings.cutoffHours[deliveryType]}時間前）を過ぎています`;
      } else {
        const conflict = findConflict(
          { start: addMinutes(start, -settings.prepBeforeMinutes), end: addMinutes(end, settings.prepAfterMinutes) },
          deliveryType,
          occupied,
          settings
        );
        if (conflict) {
          available = false;
          reason = conflict;
        }
      }

      slots.push({ time, start, end, available, reason });
    }
  }

  // 同じ時刻が複数の営業時間帯から生成されることがあるため一意化する
  const seen = new Set<string>();
  return slots
    .sort((a, b) => a.time.localeCompare(b.time))
    .filter((s) => {
      if (seen.has(s.time)) return false;
      seen.add(s.time);
      return true;
    });
}

/**
 * 候補枠が既存の予定と衝突するかを判定する。
 * 衝突していれば理由の文字列を、問題なければ null を返す。
 */
function findConflict(
  candidate: { start: Date; end: Date },
  candidateType: DeliveryType,
  occupied: Occupied[],
  settings: AppSettings
): string | null {
  for (const o of occupied) {
    // 単純な重なり
    if (candidate.start < o.end && o.start < candidate.end) {
      return `${o.label} と重なっています`;
    }

    // ブロック枠には移動の概念がないため、重なっていなければ問題なし
    if (o.deliveryType === null) continue;

    if (candidate.end <= o.start) {
      // 候補が先、既存が後 → candidateType → o.deliveryType の移動が必要
      const need = travelBufferMinutes(settings, candidateType, o.deliveryType);
      const gap = diffMinutes(o.start, candidate.end);
      if (gap < need) {
        return `次の予定（${o.label}）まで ${describeMove(candidateType, o.deliveryType)} に必要な ${need}分 が確保できません（空き ${gap}分）`;
      }
    } else if (o.end <= candidate.start) {
      // 既存が先、候補が後
      const need = travelBufferMinutes(settings, o.deliveryType, candidateType);
      const gap = diffMinutes(candidate.start, o.end);
      if (gap < need) {
        return `前の予定（${o.label}）から ${describeMove(o.deliveryType, candidateType)} に必要な ${need}分 が確保できません（空き ${gap}分）`;
      }
    }
  }
  return null;
}

function describeMove(from: DeliveryType, to: DeliveryType): string {
  if (from === "visit" && to === "visit") return "訪問先間の移動";
  if (from === "visit" && to === "online") return "訪問先から拠点への帰着";
  if (from === "online" && to === "visit") return "拠点から訪問先への移動";
  return "オンラインの切替";
}

/** 訪問可能エリアかどうか（オンラインは常に true） */
export function isServiceableArea(
  settings: AppSettings,
  deliveryType: DeliveryType,
  address: string | null | undefined
): boolean {
  if (deliveryType === "online") return true;
  if (!address) return false;
  return settings.serviceAreas.some((area) => address.includes(area));
}

/** 間取りに応じた所要時間の補正（訪問のみ） */
export function layoutAdjustment(
  settings: AppSettings,
  deliveryType: DeliveryType,
  applyAdjust: boolean,
  layout: string | null | undefined
): number {
  if (deliveryType === "online" || !applyAdjust || !layout) return 0;
  return settings.layoutAdjustMinutes[layout] ?? 0;
}
