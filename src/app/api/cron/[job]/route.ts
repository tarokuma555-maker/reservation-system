import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyOnlineSoon, notifyReminder } from "@/lib/notifications";
import { detectAndRepairDrift, retryFailedSyncs } from "@/lib/google-calendar";
import { generateOccurrences } from "@/lib/recurring";
import { getSettings } from "@/lib/settings";
import { addDays, addMinutes, jst, now, todayStr } from "@/lib/time";
import { markConnectionResult } from "@/lib/connections";
import { getLineCredentials, testLineCredentials } from "@/lib/line";
import { getGoogleCredentials, testGoogleCredentials } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 定時実行の受け口。Vercel Cron から呼ばれる。
 *
 * どの処理も「二度動いても結果が変わらない」ように作ってある。
 * 定時実行は失敗すると再送されることがあり、お客様に同じおしらせが
 * 2通届くのがいちばん困るため。
 *
 * いまのプラン（Hobby）では「1日1回のものを2つまで」しか置けない。
 * そこで毎日ぶんは daily にまとめ、Vercelからはこれ1つだけを呼ぶ。
 * 個別の受け口も残してあるので、手で動かしたいときや、
 * 外部のスケジューラから細かく呼びたいときはそちらを使う。
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const { job } = await ctx.params;

  try {
    switch (job) {
      case "daily":
        return NextResponse.json(await runDaily());
      case "reminders":
        return NextResponse.json(await sendReminders());
      case "online-soon":
        return NextResponse.json(await sendOnlineSoon());
      case "recurring":
        return NextResponse.json(await extendRecurring());
      case "calendar-repair":
        return NextResponse.json(await repairCalendar());
      case "health":
        return NextResponse.json(await checkConnections());
      default:
        return NextResponse.json({ error: `未対応の処理: ${job}` }, { status: 404 });
    }
  } catch (e) {
    console.error(`定時実行 ${job} が失敗しました`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/**
 * 毎日ぶんをまとめて動かす。
 *
 * 途中で1つ失敗しても、残りは動かす。カレンダーの調子が悪いという理由で
 * 前日のおしらせが止まってしまうと、お客様にご迷惑がかかるため。
 */
async function runDaily() {
  const results: Record<string, unknown> = {};

  for (const [name, run] of [
    ["reminders", sendReminders],
    ["recurring", extendRecurring],
    ["calendarRepair", repairCalendar],
    ["health", checkConnections],
  ] as const) {
    try {
      results[name] = await run();
    } catch (e) {
      console.error(`定時実行 ${name} が失敗しました`, e);
      results[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { job: "daily", results };
}

/** 明日のご予約に前日のおしらせを送る。すでに送った分は送らない。 */
async function sendReminders() {
  const tomorrow = addDays(todayStr(), 1);
  const list = await prisma.reservation.findMany({
    where: {
      startAt: { gte: jst(tomorrow, "00:00"), lt: jst(addDays(tomorrow, 1), "00:00") },
      status: "confirmed",
    },
    select: { id: true },
  });

  let sent = 0;
  for (const r of list) {
    const already = await prisma.outboundMessage.count({
      where: { reservationId: r.id, type: "reminder" },
    });
    if (already > 0) continue;
    await notifyReminder(r.id);
    sent++;
  }
  return { job: "reminders", targets: list.length, sent };
}

/** まもなく始まるオンラインのお客様に、少し前におしらせを送る。 */
async function sendOnlineSoon() {
  const settings = await getSettings();
  const from = now();
  const to = addMinutes(from, settings.onlineReminderMinutes);

  const list = await prisma.reservation.findMany({
    where: { deliveryType: "online", status: "confirmed", startAt: { gte: from, lte: to } },
    select: { id: true },
  });

  let sent = 0;
  for (const r of list) {
    const already = await prisma.outboundMessage.count({
      where: { reservationId: r.id, type: "online_soon" },
    });
    if (already > 0) continue;
    await notifyOnlineSoon(r.id);
    sent++;
  }
  return { job: "online-soon", targets: list.length, sent };
}

/** 定期のお客様の予定を、3か月先まで用意しておく。 */
async function extendRecurring() {
  const rules = await prisma.recurringRule.findMany({ where: { status: "active" } });
  let created = 0;
  for (const rule of rules) {
    const result = await generateOccurrences(rule.id, 90);
    created += result.created;
  }
  return { job: "recurring", rules: rules.length, created };
}

/** Googleカレンダーとのずれを直し、うつせなかった分をやり直す。 */
async function repairCalendar() {
  const repaired = await detectAndRepairDrift();
  const retried = await retryFailedSyncs();
  return { job: "calendar-repair", repaired, retried };
}

/** つながりが切れていないかを確かめ、切れていれば管理画面に出す。 */
async function checkConnections() {
  const results: Record<string, boolean> = {};

  const line = await getLineCredentials();
  if (line?.accessToken) {
    const r = await testLineCredentials(line.accessToken);
    await markConnectionResult("line", r.ok ? { ok: true } : { ok: false, error: r.error });
    results.line = r.ok;
  }

  const google = await getGoogleCredentials();
  if (google) {
    const r = await testGoogleCredentials(google);
    await markConnectionResult(
      "google_calendar",
      r.ok ? { ok: true } : { ok: false, error: r.error }
    );
    results.google_calendar = r.ok;
  }

  return { job: "health", results };
}
