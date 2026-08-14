/**
 * 日時はすべて日本時間（JST）で扱う。
 * DBには UTC で保存し、境界の変換はこのファイルに閉じ込める。
 * サーバーのタイムゾーン設定に依存しないよう、明示的に +09:00 を指定して変換する。
 */

export const JST_OFFSET = "+09:00";

/** "2026-08-20" + "10:00" → Date（UTC内部表現） */
export function jst(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00${JST_OFFSET}`);
}

/** Date → "2026-08-20"（JST基準） */
export function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Date → "10:00"（JST基準） */
export function toTimeStr(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Date → 曜日番号（0=日曜, JST基準） */
export function dayOfWeek(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function dayOfWeekOfDateStr(dateStr: string): number {
  return dayOfWeek(jst(dateStr, "12:00"));
}

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-08-20" に n 日足した日付文字列 */
export function addDays(dateStr: string, n: number): string {
  const d = jst(dateStr, "12:00");
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60_000);
}

/** "10:00" → 600（0時からの分） */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 現在時刻。デモでは実時刻を使う */
export function now(): Date {
  return new Date();
}

export function todayStr(): string {
  return toDateStr(now());
}

/** 表示用: "8月20日(木) 10:00〜13:00" */
export function formatRange(start: Date, end: Date): string {
  const ds = toDateStr(start);
  const [, mm, dd] = ds.split("-");
  const w = WEEKDAY_LABELS[dayOfWeek(start)];
  return `${Number(mm)}月${Number(dd)}日(${w}) ${toTimeStr(start)}〜${toTimeStr(end)}`;
}

export function formatDateJa(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  const w = WEEKDAY_LABELS[dayOfWeekOfDateStr(dateStr)];
  return `${Number(mm)}月${Number(dd)}日(${w})`;
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
