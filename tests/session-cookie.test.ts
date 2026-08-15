import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * ログイン判定に使うCookie名の照合。
 *
 * ここを間違えると「ログインしたのにログイン画面へ戻される」という、
 * 利用者からは原因がまったく見えない壊れ方をする。実際に一度やらかしたので、
 * 判定の条件をテストで固定しておく。
 */

const SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

/** middleware.ts と同じ判定 */
function hasSessionCookie(names: string[]): boolean {
  return names.some((name) =>
    SESSION_COOKIE_PREFIXES.some((p) => name === p || name.startsWith(`${p}.`))
  );
}

test("ふつうのセッションCookieを見つける", () => {
  assert.equal(hasSessionCookie(["authjs.session-token"]), true);
  assert.equal(hasSessionCookie(["__Secure-authjs.session-token"]), true);
});

test("分割されたセッションCookieも見つける", () => {
  // Auth.jsは大きいセッションを .0 .1 … に分けて保存する。
  // Googleログインでは実際に分割される。
  assert.equal(hasSessionCookie(["__Secure-authjs.session-token.0"]), true);
  assert.equal(
    hasSessionCookie(["__Secure-authjs.session-token.0", "__Secure-authjs.session-token.1"]),
    true
  );
  assert.equal(hasSessionCookie(["authjs.session-token.0"]), true);
});

test("関係のないCookieだけならログインとみなさない", () => {
  assert.equal(hasSessionCookie([]), false);
  assert.equal(hasSessionCookie(["_vercel_sso_nonce", "demo_customer_id"]), false);
  assert.equal(hasSessionCookie(["authjs.callback-url", "authjs.csrf-token"]), false);
});

test("名前が似ているだけの別物をログインとみなさない", () => {
  // 前方一致にすると、うっかり別のCookieを拾ってしまう危険がある。
  // 区切りのドットまで含めて確かめる。
  assert.equal(hasSessionCookie(["authjs.session-token-fake"]), false);
  assert.equal(hasSessionCookie(["x-authjs.session-token"]), false);
});
