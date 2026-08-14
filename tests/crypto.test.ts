import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  decrypt,
  decryptJson,
  encrypt,
  encryptJson,
  isEncryptionReady,
  mask,
} from "../src/lib/crypto.ts";

// 鍵は使うたびに読まれるので、ここで入れておけば間に合う。
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

test("暗号化した合いことばは、元どおりに取り出せる", () => {
  const token = "channel-access-token-" + "x".repeat(150);
  const sealed = encrypt(token);

  assert.notEqual(sealed, token, "そのまま保存されていてはいけない");
  assert.ok(!sealed.includes(token), "暗号文の中に生の値が残っていてはいけない");
  assert.equal(decrypt(sealed), token);
});

test("同じ値でも、暗号化のたびに違う文字列になる", () => {
  // 毎回同じ結果になると「2つの設定に同じ値が入っている」ことが外から分かってしまう
  const a = encrypt("same-secret");
  const b = encrypt("same-secret");
  assert.notEqual(a, b);
  assert.equal(decrypt(a), decrypt(b));
});

test("暗号文を1文字でも書き換えたら、復号を拒否する", () => {
  const sealed = encrypt("important-secret");
  const parts = sealed.split(".");
  // 本体の末尾を別の文字にすり替える
  const last = parts[3];
  parts[3] = last.slice(0, -1) + (last.endsWith("A") ? "B" : "A");

  assert.throws(() => decrypt(parts.join(".")));
});

test("別の鍵では読めない", () => {
  const sealed = encrypt("secret-under-key-1");
  const original = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  assert.throws(() => decrypt(sealed));
  process.env.ENCRYPTION_KEY = original;
});

test("オブジェクトのまま出し入れできる", () => {
  const value = { accessToken: "abc123", channelSecret: "def456", liffId: "1234-abcd" };
  const restored = decryptJson<typeof value>(encryptJson(value));
  assert.deepEqual(restored, value);
});

test("鍵の長さが足りなければ、使わせない", () => {
  const original = process.env.ENCRYPTION_KEY;

  process.env.ENCRYPTION_KEY = Buffer.from("short").toString("base64");
  assert.equal(isEncryptionReady(), false);
  assert.throws(() => encrypt("x"), /32バイト/);

  delete process.env.ENCRYPTION_KEY;
  assert.equal(isEncryptionReady(), false);

  process.env.ENCRYPTION_KEY = original;
  assert.equal(isEncryptionReady(), true);
});

test("画面に出すときは末尾4文字だけになる", () => {
  const token = "0123456789abcdefXYZW";
  const shown = mask(token);

  assert.ok(shown.endsWith("XYZW"));
  assert.ok(!shown.includes("0123456789"), "先頭は隠れていなければならない");
  assert.equal(mask(""), "");
});
