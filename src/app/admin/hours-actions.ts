"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { isDate, parseOnlineHours, parseWeeklyHours, WEEKDAY } from "@/lib/hours";

/**
 * 営業時間とお休みの出し入れ。
 *
 * ここが無いと、デモの時間（平日9-18時）のまま変えられず、
 * 実際の営業時間と食い違ったままお客様に空き時間を出してしまう。
 */

export type HoursState = { ok?: string; error?: string };


/**
 * 1週間ぶんの営業時間をまとめて保存する。
 *
 * 曜日ごとに1行ずつ受け取り、入れ替える。
 * 部分的に足し引きするより、まとめて置き換えるほうが食い違いが起きにくい。
 */
export async function saveBusinessHoursAction(
  _prev: HoursState,
  formData: FormData
): Promise<HoursState> {
  await requireStaff();

  const parsed = parseWeeklyHours((key) => {
    const v = formData.get(key);
    return v === null ? null : String(v);
  });
  if ("error" in parsed) return { error: parsed.error };
  const rows = parsed.rows;

  // 全形態むけの行（deliveryType が null）だけを入れ替える。
  // オンラインだけの夜枠などは別に持っているので、消さない。
  await prisma.$transaction([
    prisma.businessHour.deleteMany({ where: { staffId: null, deliveryType: null } }),
    prisma.businessHour.createMany({
      data: rows.map((r) => ({ ...r, staffId: null, deliveryType: null })),
    }),
  ]);

  revalidatePath("/admin", "layout");
  const open = rows.filter((r) => !r.isClosed);
  return {
    ok: `保存しました。${open.map((r) => WEEKDAY[r.dayOfWeek]).join("・")}曜日にご予約を受けます。`,
  };
}

/**
 * オンラインだけの受付時間（夜など）を入れ替える。
 * 訪問と分ける理由は、移動が要らないぶん遅い時間でも受けられるため。
 */
export async function saveOnlineHoursAction(
  _prev: HoursState,
  formData: FormData
): Promise<HoursState> {
  await requireStaff();

  const enabled = formData.get("enabled") === "on";
  if (!enabled) {
    await prisma.businessHour.deleteMany({ where: { staffId: null, deliveryType: "online" } });
    revalidatePath("/admin", "layout");
    return { ok: "オンラインだけの受付時間をやめました。" };
  }

  const parsed = parseOnlineHours(
    String(formData.get("openTime") ?? "").trim(),
    String(formData.get("closeTime") ?? "").trim(),
    formData.getAll("days").map((d) => Number(d)).filter((d) => d >= 0 && d <= 6)
  );
  if ("error" in parsed) return { error: parsed.error };
  const { days, openTime, closeTime } = parsed.rows;

  await prisma.$transaction([
    prisma.businessHour.deleteMany({ where: { staffId: null, deliveryType: "online" } }),
    prisma.businessHour.createMany({
      data: days.map((d) => ({
        staffId: null,
        deliveryType: "online",
        dayOfWeek: d,
        openTime,
        closeTime,
        isClosed: false,
      })),
    }),
  ]);

  revalidatePath("/admin", "layout");
  return {
    ok: `保存しました。${days.map((d) => WEEKDAY[d]).join("・")}曜日の ${openTime}〜${closeTime} は、オンラインのご予約も受けます。`,
  };
}

/* ---------------- お休みの日 ---------------- */

export async function addHolidayAction(
  _prev: HoursState,
  formData: FormData
): Promise<HoursState> {
  await requireStaff();

  const date = String(formData.get("date") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isDate(date)) return { error: "日にちをえらんでください。" };
  if (endDate && !isDate(endDate)) return { error: "終わりの日にちが正しくありません。" };
  if (endDate && endDate < date) {
    return { error: "終わりの日にちを、始まりより後にしてください。" };
  }

  const already = await prisma.holiday.findFirst({ where: { date } });
  if (already) return { error: `${date} は、すでにお休みに入っています。` };

  await prisma.holiday.create({ data: { date, endDate: endDate || null, reason } });

  revalidatePath("/admin", "layout");
  return {
    ok: endDate ? `${date} 〜 ${endDate} をお休みにしました。` : `${date} をお休みにしました。`,
  };
}

export async function deleteHolidayAction(
  _prev: HoursState,
  formData: FormData
): Promise<HoursState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "どの日か分かりませんでした。" };

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) return { error: "その日は見つかりませんでした。" };

  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/admin", "layout");
  return { ok: `${holiday.date} のお休みを取り消しました。` };
}
