import crypto from "node:crypto";
import { getLineCredentials } from "./line";

/**
 * お客様側の本人確認。
 *
 * LINEの中で画面を開くと、LINEが「この人は誰か」を証明する引換券（IDトークン）をくれる。
 * それをそのまま信じてはいけない。ブラウザから送られてくる以上、
 * 手元で書き換えられる可能性があるためで、信じると他人の予約を覗けてしまう。
 *
 * そこで **必ずLINEに問い合わせて本物か確かめてから** 使う。
 * 確かめたあとは、こちらで署名した合いことばをCookieに入れ、
 * 以降のページではそれを見る（毎回LINEに問い合わせると遅くなるため）。
 */

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export const LIFF_SESSION_COOKIE = "liff_session";

/** 合いことばの有効期間。長すぎると端末を渡したときに困るため、ほどほどにする。 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type VerifiedLineUser = {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
};

/**
 * LIFF IDから、問い合わせに使う番号を取り出す。
 * LIFF IDは「1234567890-abcdefgh」の形で、前半がその番号にあたる。
 */
export function channelIdFromLiffId(liffId: string): string | null {
  const head = liffId.split("-")[0]?.trim();
  return head && /^\d+$/.test(head) ? head : null;
}

/**
 * IDトークンをLINEに問い合わせて確かめる。
 *
 * 宛先（aud）が自分のものかどうかもLINE側で照合される。
 * これを省くと、よそのアプリ向けに発行されたトークンで入られてしまう。
 */
export async function verifyLiffIdToken(
  idToken: string
): Promise<{ ok: true; user: VerifiedLineUser } | { ok: false; error: string }> {
  const credentials = await getLineCredentials();
  const liffId = credentials?.liffId;
  if (!liffId) {
    return { ok: false, error: "LIFF IDが設定されていません" };
  }

  const clientId = channelIdFromLiffId(liffId);
  if (!clientId) {
    return { ok: false, error: "LIFF IDの形式が想定と違います" };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });

    if (!res.ok) {
      return { ok: false, error: `LINEでの確認に失敗しました (${res.status})` };
    }

    const claims = (await res.json()) as {
      sub?: string;
      name?: string;
      picture?: string;
      aud?: string;
    };

    if (!claims.sub) {
      return { ok: false, error: "LINEの返事に利用者の情報が含まれていません" };
    }

    // 念のため宛先も自分で確かめる（LINE側でも見ているが、二重に確認する）
    if (claims.aud && claims.aud !== clientId) {
      return { ok: false, error: "別のアプリ向けの情報でした" };
    }

    return {
      ok: true,
      user: { lineUserId: claims.sub, displayName: claims.name, pictureUrl: claims.picture },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------------- こちらで署名する合いことば ---------------- */

function signingKey(): string {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new Error("AUTH_SECRET が設定されていません");
  return key;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** 確認できたお客様を、書き換えられない形の文字列にする */
export function createLiffSession(customerId: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${customerId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * 合いことばを読み解く。
 * 書き換えられていたり、期限が切れていれば null を返す（＝未確認あつかい）。
 */
export function readLiffSession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [customerId, expiresAtRaw, signature] = parts;
  const payload = `${customerId}.${expiresAtRaw}`;

  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return null;
  if (expiresAt * 1000 <= now) return null;

  return customerId || null;
}

export const LIFF_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;
