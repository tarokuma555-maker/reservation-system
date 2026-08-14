import { prisma } from "./db";
import { getOwnerStaffId } from "./staff";
import { formatYen, toDateStr } from "./time";

/**
 * Googleカレンダー同期。
 *
 * 予約データの「正」は本システムのDB。Googleカレンダーはミラーであり、
 * 私用予定の取り込み口でもある。
 *
 * GOOGLE_REFRESH_TOKEN 等が設定されていれば実際のGoogle Calendar APIを呼び、
 * 未設定なら CalendarEvent テーブルを「Google側の状態」に見立てて同じ処理を行う。
 * どちらのモードでも同期状態は CalendarSync に残るため、失敗時のリトライも共通。
 */

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function isGoogleLive(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

export function googleMode(): "live" | "mock" {
  return isGoogleLive() ? "live" : "mock";
}

export function targetCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function calendarFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/* ---------------- イベントの組み立て ---------------- */

type EventInput = {
  summary: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  reservationId: string;
  needsConference: boolean;
};

async function buildEventInput(reservationId: string): Promise<EventInput> {
  const r = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { customer: true, menu: true, options: true },
  });

  const icon = r.deliveryType === "visit" ? "🏠" : "💻";
  const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  return {
    summary: `${icon} ${r.customer.name}様 / ${r.menu.name}`,
    description: [
      `お客様: ${r.customer.name}様${r.customer.companyName ? `（${r.customer.companyName}）` : ""}`,
      `電話: ${r.customer.phone}`,
      `メニュー: ${r.menu.name}`,
      r.options.length ? `オプション: ${r.options.map((o) => o.name).join("・")}` : null,
      `所要時間: ${r.totalMinutes}分`,
      `料金: ${formatYen(r.totalPrice)}（税込）`,
      r.customerNote ? `ご要望: ${r.customerNote}` : null,
      "",
      `予約詳細: ${appUrl}/admin/reservations/${r.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: r.deliveryType === "visit" ? (r.serviceAddress ?? "") : "オンライン",
    startAt: r.startAt,
    endAt: r.endAt,
    reservationId: r.id,
    needsConference: r.deliveryType === "online",
  };
}

function toGoogleEventBody(input: EventInput, forConference: boolean) {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startAt.toISOString(), timeZone: "Asia/Tokyo" },
    end: { dateTime: input.endAt.toISOString(), timeZone: "Asia/Tokyo" },
    // システムが作ったイベントを識別するための印
    extendedProperties: { private: { reservationId: input.reservationId } },
    ...(forConference
      ? {
          conferenceData: {
            createRequest: {
              requestId: `res-${input.reservationId}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
  };
}

/* ---------------- 同期本体 ---------------- */

export type SyncResult = {
  status: "synced" | "failed";
  googleEventId?: string;
  meetUrl?: string | null;
  error?: string;
  mode: "live" | "mock";
};

/** 予約をGoogleカレンダーへ書き出す（新規作成 or 更新） */
export async function syncReservationToCalendar(reservationId: string): Promise<SyncResult> {
  const input = await buildEventInput(reservationId);
  const existing = await prisma.calendarSync.findUnique({ where: { reservationId } });
  const calendarId = targetCalendarId();

  try {
    let googleEventId: string;
    let meetUrl: string | null = null;

    if (isGoogleLive()) {
      const body = toGoogleEventBody(input, input.needsConference);
      const query = input.needsConference ? "?conferenceDataVersion=1" : "";

      if (existing?.googleEventId) {
        const res = (await calendarFetch(
          `/calendars/${encodeURIComponent(calendarId)}/events/${existing.googleEventId}${query}`,
          { method: "PATCH", body: JSON.stringify(body) }
        )) as { id: string; hangoutLink?: string };
        googleEventId = res.id;
        meetUrl = res.hangoutLink ?? null;
      } else {
        const res = (await calendarFetch(
          `/calendars/${encodeURIComponent(calendarId)}/events${query}`,
          { method: "POST", body: JSON.stringify(body) }
        )) as { id: string; hangoutLink?: string };
        googleEventId = res.id;
        meetUrl = res.hangoutLink ?? null;
      }
    } else {
      // モック: Google側の状態を CalendarEvent テーブルで再現する
      googleEventId = existing?.googleEventId ?? `mock_evt_${reservationId.slice(-10)}`;
      meetUrl = input.needsConference
        ? `https://meet.google.com/${mockMeetCode(reservationId)}`
        : null;

      await prisma.calendarEvent.upsert({
        where: { googleEventId },
        create: {
          googleEventId,
          calendarId,
          summary: input.summary,
          description: input.description,
          location: input.location,
          startAt: input.startAt,
          endAt: input.endAt,
          conferenceUrl: meetUrl,
          privateReservationId: input.reservationId,
          source: "system",
          isDeleted: false,
        },
        update: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          startAt: input.startAt,
          endAt: input.endAt,
          conferenceUrl: meetUrl,
          isDeleted: false,
        },
      });
    }

    // オンラインの場合、発行された会議URLを予約に書き戻す
    if (input.needsConference && meetUrl) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { meetingUrl: meetUrl },
      });
    }

    await prisma.calendarSync.upsert({
      where: { reservationId },
      create: {
        reservationId,
        googleEventId,
        calendarId,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        retryCount: 0,
        lastError: null,
      },
      update: {
        googleEventId,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        retryCount: 0,
        lastError: null,
      },
    });

    return { status: "synced", googleEventId, meetUrl, mode: googleMode() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.calendarSync.upsert({
      where: { reservationId },
      create: {
        reservationId,
        calendarId,
        syncStatus: "failed",
        retryCount: 1,
        lastError: message,
      },
      update: {
        syncStatus: "failed",
        retryCount: { increment: 1 },
        lastError: message,
      },
    });
    return { status: "failed", error: message, mode: googleMode() };
  }
}

export async function deleteReservationFromCalendar(reservationId: string) {
  const sync = await prisma.calendarSync.findUnique({ where: { reservationId } });
  if (!sync?.googleEventId) return { status: "skipped" as const, mode: googleMode() };

  try {
    if (isGoogleLive()) {
      await calendarFetch(
        `/calendars/${encodeURIComponent(sync.calendarId)}/events/${sync.googleEventId}`,
        { method: "DELETE" }
      );
    } else {
      await prisma.calendarEvent.updateMany({
        where: { googleEventId: sync.googleEventId },
        data: { isDeleted: true },
      });
    }
    await prisma.calendarSync.update({
      where: { reservationId },
      data: { syncStatus: "deleted", lastSyncedAt: new Date(), lastError: null },
    });
    return { status: "deleted" as const, mode: googleMode() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.calendarSync.update({
      where: { reservationId },
      data: { syncStatus: "failed", retryCount: { increment: 1 }, lastError: message },
    });
    return { status: "failed" as const, error: message, mode: googleMode() };
  }
}

/**
 * Google側の私用予定を取り込み、ブロック枠にする。
 * システムが作ったイベント（extendedProperties に reservationId があるもの）は除外する。
 */
export async function importPersonalEventsAsBlocks(fromDate: Date, toDate: Date) {
  const staffId = await getOwnerStaffId();
  const calendarId = targetCalendarId();

  type Ext = { private?: Record<string, string> };
  type GEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
    extendedProperties?: Ext;
  };

  let events: GEvent[];

  if (isGoogleLive()) {
    const params = new URLSearchParams({
      timeMin: fromDate.toISOString(),
      timeMax: toDate.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });
    const res = (await calendarFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    )) as { items: GEvent[] };
    events = res.items ?? [];
  } else {
    const rows = await prisma.calendarEvent.findMany({
      where: { isDeleted: false, startAt: { gte: fromDate, lt: toDate } },
    });
    events = rows.map((r) => ({
      id: r.googleEventId,
      summary: r.summary,
      start: { dateTime: r.startAt.toISOString() },
      end: { dateTime: r.endAt.toISOString() },
      extendedProperties: r.privateReservationId
        ? { private: { reservationId: r.privateReservationId } }
        : undefined,
    }));
  }

  let imported = 0;
  let skipped = 0;

  for (const ev of events) {
    if (ev.extendedProperties?.private?.reservationId) {
      skipped++; // 本システムが作ったイベントなので取り込まない
      continue;
    }
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue;

    const existing = await prisma.blockedSlot.findFirst({ where: { googleEventId: ev.id } });
    const data = {
      staffId,
      startAt: new Date(ev.start.dateTime),
      endAt: new Date(ev.end.dateTime),
      title: ev.summary ?? "Googleカレンダーの予定",
      source: "google",
      googleEventId: ev.id,
    };

    if (existing) {
      await prisma.blockedSlot.update({ where: { id: existing.id }, data });
    } else {
      await prisma.blockedSlot.create({ data });
      imported++;
    }
  }

  return { imported, skipped, total: events.length, mode: googleMode() };
}

/**
 * Google側でシステム作成イベントが消されていないかを確認し、消えていれば復元する。
 * 「予約の変更は管理画面から」という運用ルールを、仕組みでも担保する。
 */
export async function detectAndRepairDrift() {
  const syncs = await prisma.calendarSync.findMany({
    where: { syncStatus: "synced" },
  });

  const repaired: string[] = [];

  for (const sync of syncs) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: sync.reservationId },
    });
    // キャンセル・スキップ済みの予約は、Google側に無いのが正しい状態
    if (!reservation || !["confirmed", "completed"].includes(reservation.status)) continue;

    let missing = false;
    if (isGoogleLive()) {
      try {
        await calendarFetch(
          `/calendars/${encodeURIComponent(sync.calendarId)}/events/${sync.googleEventId}`
        );
      } catch {
        missing = true;
      }
    } else {
      const ev = await prisma.calendarEvent.findUnique({
        where: { googleEventId: sync.googleEventId ?? "" },
      });
      missing = !ev || ev.isDeleted;
    }

    if (missing) {
      await syncReservationToCalendar(sync.reservationId);
      repaired.push(sync.reservationId);
    }
  }

  return { repaired, mode: googleMode() };
}

/** 失敗した同期をまとめてやり直す */
export async function retryFailedSyncs() {
  const failed = await prisma.calendarSync.findMany({ where: { syncStatus: "failed" } });
  const results = [];
  for (const f of failed) {
    results.push(await syncReservationToCalendar(f.reservationId));
  }
  return results;
}

/** 全予約をカレンダーへ書き出す（初回接続時の一括同期） */
export async function syncAllReservations() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ["confirmed", "completed"] }, startAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    select: { id: true },
  });
  let ok = 0;
  let ng = 0;
  for (const r of reservations) {
    const res = await syncReservationToCalendar(r.id);
    res.status === "synced" ? ok++ : ng++;
  }
  return { ok, ng, mode: googleMode() };
}

function mockMeetCode(seed: string): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz";
  const pick = (offset: number, len: number) =>
    Array.from({ length: len }, (_, i) =>
      alphabet[(seed.charCodeAt((offset + i) % seed.length) + i * 7) % alphabet.length]
    ).join("");
  return `${pick(0, 3)}-${pick(3, 4)}-${pick(7, 3)}`;
}

export function describeSyncTarget(): string {
  return isGoogleLive()
    ? `Googleカレンダー（${targetCalendarId()}）に実際に書き出します`
    : "モックモード: Google側の状態をこのシステム内で再現しています";
}

export { toDateStr };
