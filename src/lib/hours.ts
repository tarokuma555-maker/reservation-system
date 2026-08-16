/**
 * 営業時間の入力チェック。
 *
 * 画面から来た値をそのまま保存すると、「終わりが始まりより前」のような
 * 決して埋まらない時間帯ができ、お客様の予約画面から空きが消える。
 * 保存する前にここで止める。
 *
 * サーバー処理から切り出しているのは、単体で確かめられるようにするため。
 */

export const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"] as const;

export type DayHours = {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function isDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

type Parsed<T> = { rows: T } | { error: string };

/** 1週間ぶんの受付時間を読み取る */
export function parseWeeklyHours(get: (key: string) => string | null): Parsed<DayHours[]> {
  const rows: DayHours[] = [];

  for (let d = 0; d <= 6; d++) {
    if (get(`closed_${d}`) === "on") {
      rows.push({ dayOfWeek: d, isClosed: true, openTime: "00:00", closeTime: "00:00" });
      continue;
    }

    const openTime = (get(`open_${d}`) ?? "").trim();
    const closeTime = (get(`close_${d}`) ?? "").trim();

    if (!isTime(openTime) || !isTime(closeTime)) {
      return { error: `${WEEKDAY[d]}曜日の時間を、9:00 のような形で入れてください。` };
    }
    if (openTime >= closeTime) {
      return {
        error: `${WEEKDAY[d]}曜日は、終わりの時刻を始まりより後にしてください（いまは ${openTime} → ${closeTime}）。`,
      };
    }
    rows.push({ dayOfWeek: d, isClosed: false, openTime, closeTime });
  }

  if (rows.every((r) => r.isClosed)) {
    return { error: "すべての曜日をお休みにすると、ご予約を受けられなくなります。" };
  }

  return { rows };
}

export type OnlineHours = { days: number[]; openTime: string; closeTime: string };

/** オンラインだけの受付時間を読み取る */
export function parseOnlineHours(
  openTime: string,
  closeTime: string,
  days: number[]
): Parsed<OnlineHours> {
  if (!isTime(openTime) || !isTime(closeTime)) {
    return { error: "時間を、20:00 のような形で入れてください。" };
  }
  if (openTime >= closeTime) {
    return { error: "終わりの時刻を、始まりより後にしてください。" };
  }
  if (days.length === 0) return { error: "曜日を1つ以上えらんでください。" };

  return { rows: { days, openTime, closeTime } };
}
