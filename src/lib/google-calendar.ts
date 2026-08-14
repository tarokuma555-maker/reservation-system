import { prisma } from "./db";
import { getConnection, getCredentials, markConnectionResult } from "./connections";
import { getOwnerStaffId } from "./staff";
import { formatYen, toDateStr } from "./time";

/**
 * Googleカレンダー同期。
 *
 * 予約データの「正」は本システムのDB。Googleカレンダーはミラーであり、
 * 私用予定の取り込み口でもある。
 *
 * つながっていれば実際のGoogle Calendar APIを呼び、つながっていなければ
 * CalendarEvent テーブルを「Google側の状態」に見立てて同じ処理を行う。
 * どちらの場合も同期状態は CalendarSync に残るため、失敗時のやり直しも共通。
 */

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** カレンダーの読み書きだけを求める。メールや連絡先には触らない。 */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export type GoogleCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

function credentialsFromEnv(): GoogleCredentials | null {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN,
  };
}

export async function getGoogleCredentials(): Promise<GoogleCredentials | null> {
  const { credentials } = await getCredentials<GoogleCredentials>(
    "google_calendar",
    credentialsFromEnv
  );
  return credentials;
}

export async function getGoogleConnection() {
  return getConnection("google_calendar", () => credentialsFromEnv() !== null);
}

export async function isGoogleLive(): Promise<boolean> {
  return (await getGoogleCredentials()) !== null;
}

export async function googleMode(): Promise<"live" | "mock"> {
  return (await isGoogleLive()) ? "live" : "mock";
}

/** 書き出し先のカレンダー。つないだあと画面から選べる。 */
export async function targetCalendarId(): Promise<string> {
  const conn = await getGoogleConnection();
  const fromConfig = conn.config.calendarId;
  if (typeof fromConfig === "string" && fromConfig) return fromConfig;
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

/* ---------------- つなぐ（OAuth） ---------------- */

/**
 * Googleの確認画面へ送るURLを組み立てる。
 *
 * access_type=offline と prompt=consent を必ず付ける。これが無いと
 * リフレッシュトークンが返らず、一度きりの接続になってしまう。
 */
export function buildConsentUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: params.state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

/** 戻ってきた引換券を、ずっと使えるリフレッシュトークンに交換する */
export async function exchangeCodeForRefreshToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ ok: true; refreshToken: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
        code: params.code,
        grant_type: "authorization_code",
      }),
    });
    const json = (await res.json()) as { refresh_token?: string; error_description?: string };
    if (!res.ok) {
      return { ok: false, error: json.error_description ?? `Googleからの返事: ${res.status}` };
    }
    if (!json.refresh_token) {
      return {
        ok: false,
        error:
          "Googleから継続利用の許可が返りませんでした。一度 https://myaccount.google.com/permissions " +
          "でこのアプリの許可を取り消してから、もう一度おためしください。",
      };
    }
    return { ok: true, refreshToken: json.refresh_token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** つながっているカレンダーの一覧。書き出し先を選ぶために使う。 */
export async function listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const json = (await calendarFetch("/users/me/calendarList")) as {
    items?: { id: string; summary: string; primary?: boolean }[];
  };
  return (json.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
  }));
}

/** 合いことばが生きているか確かめる */
export async function testGoogleCredentials(
  c: GoogleCredentials
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await accessTokenFrom(c);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function accessTokenFrom(c: GoogleCredentials): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) {
      throw new Error(
        "Googleとのつながりが切れています。許可が取り消された可能性があります。つなぎ直してください。"
      );
    }
    throw new Error(`Googleからの返事: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function getAccessToken(): Promise<string> {
  const c = await getGoogleCredentials();
  if (!c) throw new Error("Googleカレンダーにつながっていません");
  return accessTokenFrom(c);
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

  const label = r.deliveryType === "visit" ? "訪問" : "オンライン";
  const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  return {
    summary: `【${label}】${r.customer.name}様 / ${r.menu.name}`,
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
  const calendarId = await targetCalendarId();

  try {
    let googleEventId: string;
    let meetUrl: string | null = null;

    if (await isGoogleLive()) {
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

    return { status: "synced", googleEventId, meetUrl, mode: await googleMode() };
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
    return { status: "failed", error: message, mode: await googleMode() };
  }
}

export async function deleteReservationFromCalendar(reservationId: string) {
  const sync = await prisma.calendarSync.findUnique({ where: { reservationId } });
  if (!sync?.googleEventId) return { status: "skipped" as const, mode: await googleMode() };

  try {
    if (await isGoogleLive()) {
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
    return { status: "deleted" as const, mode: await googleMode() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.calendarSync.update({
      where: { reservationId },
      data: { syncStatus: "failed", retryCount: { increment: 1 }, lastError: message },
    });
    return { status: "failed" as const, error: message, mode: await googleMode() };
  }
}

/**
 * Google側の私用予定を取り込み、ブロック枠にする。
 * システムが作ったイベント（extendedProperties に reservationId があるもの）は除外する。
 */
export async function importPersonalEventsAsBlocks(fromDate: Date, toDate: Date) {
  const staffId = await getOwnerStaffId();
  const calendarId = await targetCalendarId();

  type Ext = { private?: Record<string, string> };
  type GEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
    extendedProperties?: Ext;
  };

  let events: GEvent[];

  if (await isGoogleLive()) {
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

  return { imported, skipped, total: events.length, mode: await googleMode() };
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
    if (await isGoogleLive()) {
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

  return { repaired, mode: await googleMode() };
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
  return { ok, ng, mode: await googleMode() };
}

function mockMeetCode(seed: string): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz";
  const pick = (offset: number, len: number) =>
    Array.from({ length: len }, (_, i) =>
      alphabet[(seed.charCodeAt((offset + i) % seed.length) + i * 7) % alphabet.length]
    ).join("");
  return `${pick(0, 3)}-${pick(3, 4)}-${pick(7, 3)}`;
}

export async function describeSyncTarget(): Promise<string> {
  return (await isGoogleLive())
    ? `Googleカレンダー（${await targetCalendarId()}）に実際に書き出します`
    : "まだつながっていません。Google側の動きをこのシステム内で再現しています";
}

export { toDateStr };
