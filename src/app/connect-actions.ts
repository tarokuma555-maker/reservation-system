"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import {
  disconnect,
  saveConnection,
  updateConnectionConfig,
  updateCredentials,
} from "@/lib/connections";
import { getLineCredentials, testLineCredentials, type LineCredentials } from "@/lib/line";
import { googleRedirectUri, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth";
import { getVisionCredentials, testVisionCredentials } from "@/lib/ocr";
import {
  buildConsentUrl,
  getGoogleCredentials,
  listCalendars,
  testGoogleCredentials,
} from "@/lib/google-calendar";

/**
 * 外部サービスとのつなぎこみ。
 *
 * どの処理も「保存する前に疎通を確かめる」形にしている。
 * まちがった合いことばを保存してしまうと「送ったつもりで届いていない」という、
 * いちばん気づきにくい壊れ方をするため。
 */

export type ConnectState = { ok?: string; error?: string; detail?: string };

/* ---------------- LINE ---------------- */

export async function connectLineAction(
  _prev: ConnectState,
  formData: FormData
): Promise<ConnectState> {
  const staff = await requireStaff();

  // おためし用の置き場所を実際のLINEにつなぐと、架空のご予約から
  // 本物のお客様へおしらせが飛んでしまう。ここで止める。
  if (isDemoMode()) {
    return {
      error:
        "こちらはおためし用の画面なので、実際のLINEにはつなげません。本番の画面からお願いします。",
    };
  }

  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const channelSecret = String(formData.get("channelSecret") ?? "").trim();

  if (!accessToken || !channelSecret) {
    return { error: "2つとも貼り付けてください。どちらか片方だけでは動きません。" };
  }

  // 貼りまちがいでいちばん多いのが、前後に空白や改行が混ざるケース。
  // trim してから確かめているので、その分は自動で直る。
  const result = await testLineCredentials(accessToken);
  if (!result.ok) return { error: result.error };

  // LIFF IDは手順4で別に入れてもらう。合いことばを貼り直しただけで
  // 予約画面へのつながりが消えると、原因の分からない壊れ方になるため引き継ぐ。
  const previous = await getLineCredentials();

  await saveConnection({
    provider: "line",
    credentials: { accessToken, channelSecret, liffId: previous?.liffId || undefined },
    label: result.botName,
    actorName: staff.name,
  });

  revalidatePath("/admin", "layout");
  return {
    ok: `「${result.botName}」につながりました。`,
    detail: result.basicId ? `LINE ID: ${result.basicId}` : undefined,
  };
}

/**
 * LIFF IDだけを入れ直す。
 * 合いことばを貼り直さずに済むようにするため、専用の口を用意している。
 */
export async function saveLiffIdAction(
  _prev: ConnectState,
  formData: FormData
): Promise<ConnectState> {
  await requireStaff();

  const liffId = String(formData.get("liffId") ?? "").trim();
  if (!liffId) return { error: "LIFF IDを貼り付けてください。" };

  // 「数字 - 英数字」の形。ここでずれていると、あとで原因が分かりにくい壊れ方をする
  if (!/^\d{8,}-[0-9a-zA-Z]+$/.test(liffId)) {
    return {
      error:
        "LIFF IDの形が違うようです。「1234567890-abcdefgh」のような、数字とハイフンで始まる文字列を貼り付けてください。",
    };
  }

  const updated = await updateCredentials<LineCredentials>("line", { liffId });
  if (!updated) {
    return { error: "先にLINEとつないでください（手順1）。" };
  }

  revalidatePath("/admin", "layout");
  return { ok: "予約画面をLINEにつなぎました。" };
}

export async function disconnectLineAction(): Promise<void> {
  const staff = await requireStaff();
  await disconnect("line", staff.name);
  revalidatePath("/admin", "layout");
}

/** つながったままの状態で、いま本当に届くかを確かめ直す */
export async function recheckLineAction(): Promise<void> {
  const credentials = await getLineCredentials();
  if (!credentials?.accessToken) return;
  const result = await testLineCredentials(credentials.accessToken);
  const { markConnectionResult } = await import("@/lib/connections");
  await markConnectionResult("line", result.ok ? { ok: true } : { ok: false, error: result.error });
  revalidatePath("/admin", "layout");
}

/* ---------------- Googleカレンダー ---------------- */

/**
 * Googleの確認画面へ送り出す。
 *
 * 事業者IDと合いことばはこの時点ではまだ保存しない。許可が返ってきて
 * 初めて保存する。途中でやめたときに、中途半端な状態を残さないため。
 */
export async function startGoogleConnectAction(formData: FormData): Promise<void> {
  await requireStaff();

  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  if (!clientId || !clientSecret) redirect("/admin/calendar-sync?error=missing");

  // 戻ってきたときに「自分が始めた手続きか」を確かめるための合いことば
  const state = crypto.randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set(GOOGLE_OAUTH_STATE_COOKIE, JSON.stringify({ state, clientId, clientSecret }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });

  redirect(buildConsentUrl({ clientId, redirectUri: googleRedirectUri(), state }));
}

export async function disconnectGoogleAction(): Promise<void> {
  const staff = await requireStaff();
  await disconnect("google_calendar", staff.name);
  revalidatePath("/admin", "layout");
}

/**
 * 書き出し先のカレンダーを決める。
 *
 * 以前は何も返しておらず、押しても画面が変わらないため
 * 効いていないように見えていた。決まった先を読み上げて返す。
 */
export async function selectCalendarAction(
  _prev: ConnectState,
  formData: FormData
): Promise<ConnectState> {
  await requireStaff();

  const calendarId = String(formData.get("calendarId") ?? "").trim();
  if (!calendarId) return { error: "書き出し先のカレンダーをえらんでください。" };

  await updateConnectionConfig("google_calendar", { calendarId });

  // 選んだ先の名前を添える。IDだけだと、どれを選んだのか分からない。
  const label = await calendarLabel(calendarId);
  revalidatePath("/admin/calendar-sync");
  return { ok: `これから「${label}」に書き出します。` };
}

async function calendarLabel(calendarId: string): Promise<string> {
  try {
    const list = await listCalendars();
    return list.find((c) => c.id === calendarId)?.summary ?? calendarId;
  } catch {
    return calendarId;
  }
}

/** つながったままの状態で、いま本当に書き込めるかを確かめ直す */
export async function recheckGoogleAction(): Promise<void> {
  const credentials = await getGoogleCredentials();
  if (!credentials) return;
  const result = await testGoogleCredentials(credentials);
  const { markConnectionResult } = await import("@/lib/connections");
  await markConnectionResult(
    "google_calendar",
    result.ok ? { ok: true } : { ok: false, error: result.error }
  );
  revalidatePath("/admin", "layout");
}

/** 書き出し先に選べるカレンダーの一覧 */
export async function fetchCalendarChoices(): Promise<
  { id: string; summary: string; primary: boolean }[]
> {
  try {
    return await listCalendars();
  } catch {
    return [];
  }
}

/* ---------------- レシートの読み取り（Cloud Vision） ---------------- */

/**
 * 読み取り用の合いことばを入れる。
 *
 * 保存する前に、実際にGoogleへ1回問い合わせて使えるか確かめる。
 * まちがったまま保存すると、レシートを撮ったときに初めて失敗が分かる。
 */
export async function connectVisionAction(
  _prev: ConnectState,
  formData: FormData
): Promise<ConnectState> {
  const staff = await requireStaff();

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "合いことば（APIキー）を貼り付けてください。" };

  const result = await testVisionCredentials(apiKey);
  if (!result.ok) return { error: result.error };

  await saveConnection({
    provider: "google_vision",
    credentials: { apiKey },
    label: "レシートの読み取り",
    actorName: staff.name,
  });

  revalidatePath("/admin", "layout");
  return { ok: "つながりました。これから写真のレシートをそのまま読み取ります。" };
}

export async function disconnectVisionAction(): Promise<void> {
  const staff = await requireStaff();
  await disconnect("google_vision", staff.name);
  revalidatePath("/admin", "layout");
}

/** つながったままの状態で、いま本当に読み取れるかを確かめ直す */
export async function recheckVisionAction(
  _prev: ConnectState,
  _formData: FormData
): Promise<ConnectState> {
  await requireStaff();
  const credentials = await getVisionCredentials();
  if (!credentials?.apiKey) return { error: "まだつながっていません。" };

  const result = await testVisionCredentials(credentials.apiKey);
  const { markConnectionResult } = await import("@/lib/connections");
  await markConnectionResult(
    "google_vision",
    result.ok ? { ok: true } : { ok: false, error: result.error }
  );
  revalidatePath("/admin", "layout");
  return result.ok ? { ok: "いま確かめました。問題なく読み取れます。" } : { error: result.error };
}
