import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-only-secret-for-liff-session";

import {
  channelIdFromLiffId,
  createLiffSession,
  readLiffSession,
  LIFF_SESSION_MAX_AGE,
} from "../src/lib/liff-auth.ts";

/**
 * ここが破られると、他のお客様の氏名・住所・電話番号が見えてしまう。
 * 「読めること」より「偽物を弾くこと」を重点的に確かめる。
 */

test("確認できたお客様は、あとから取り出せる", () => {
  const session = createLiffSession("customer-abc");
  assert.equal(readLiffSession(session), "customer-abc");
});

test("中身を書き換えたら、受け付けない", () => {
  const session = createLiffSession("customer-abc");
  const [, expiresAt, signature] = session.split(".");

  // 別のお客様になりすます
  const forged = `customer-victim.${expiresAt}.${signature}`;
  assert.equal(readLiffSession(forged), null);
});

test("署名を書き換えたら、受け付けない", () => {
  const session = createLiffSession("customer-abc");
  const [id, expiresAt] = session.split(".");
  assert.equal(readLiffSession(`${id}.${expiresAt}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`), null);
});

test("期限を自分で延ばしても、受け付けない", () => {
  const session = createLiffSession("customer-abc");
  const [id, , signature] = session.split(".");
  const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3650;
  assert.equal(readLiffSession(`${id}.${farFuture}.${signature}`), null);
});

test("期限が切れたものは、受け付けない", () => {
  const past = Date.now() - (LIFF_SESSION_MAX_AGE + 60) * 1000;
  const old = createLiffSession("customer-abc", past);
  assert.equal(readLiffSession(old), null, "期限切れは通さない");

  // 期限内なら通る（境界の確認）
  const recent = createLiffSession("customer-abc", Date.now() - 60 * 1000);
  assert.equal(readLiffSession(recent), "customer-abc");
});

test("こわれた値や空の値でも、落ちずに未確認あつかいにする", () => {
  for (const bad of [undefined, "", "abc", "a.b", "a.b.c.d", "...", "customer.notanumber.sig"]) {
    assert.equal(readLiffSession(bad as string | undefined), null, `${bad} は通してはいけない`);
  }
});

test("別の鍵で作られたものは、受け付けない", () => {
  const session = createLiffSession("customer-abc");
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-completely-different-secret";
  assert.equal(readLiffSession(session), null);
  process.env.AUTH_SECRET = original;
});

test("LIFF IDから、問い合わせ用の番号を取り出せる", () => {
  assert.equal(channelIdFromLiffId("1234567890-abcdefgh"), "1234567890");
  // 想定外の形は取り出さない（あいまいなまま問い合わせに使わない）
  assert.equal(channelIdFromLiffId("not-a-liff-id"), null);
  assert.equal(channelIdFromLiffId(""), null);
});
