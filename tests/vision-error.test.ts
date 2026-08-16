import { test } from "node:test";
import assert from "node:assert/strict";

import { explainVisionError } from "../src/lib/ocr.ts";

/**
 * Googleからの断り文句の読み解き。
 *
 * 403はまったく別の原因が同じ番号で返ってくる。
 * ひとまとめに「確認してください」と出すと、どこを直せばよいのか分からない。
 */

test("APIがまだ有効になっていないとき、有効にする場所を案内する", () => {
  const body = JSON.stringify({
    error: {
      code: 403,
      message:
        "Cloud Vision API has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/vision.googleapis.com/overview?project=123456 then retry.",
      status: "PERMISSION_DENIED",
      details: [{ reason: "SERVICE_DISABLED" }],
    },
  });
  const msg = explainVisionError(403, body);
  assert.match(msg, /有効になっていません/);
  assert.match(msg, /console\.developers\.google\.com/);
});

test("お支払いの設定がまだのとき、無料枠の話も添えて案内する", () => {
  const body = JSON.stringify({
    error: {
      code: 403,
      message:
        "This API method requires billing to be enabled. Please enable billing on project #123456 by visiting https://console.developers.google.com/billing/enable?project=123456 then retry.",
      status: "PERMISSION_DENIED",
      details: [{ reason: "BILLING_DISABLED" }],
    },
  });
  const msg = explainVisionError(403, body);
  assert.match(msg, /お支払い/);
  assert.match(msg, /1,000枚まで無料/);
  assert.match(msg, /billing\/enable/);
});

test("鍵の制限で弾かれたとき、どの設定を見ればよいかを言う", () => {
  const body = JSON.stringify({
    error: {
      code: 403,
      message: "Requests to this API vision.googleapis.com method ... are blocked.",
      status: "PERMISSION_DENIED",
      details: [{ reason: "API_KEY_SERVICE_BLOCKED" }],
    },
  });
  assert.match(explainVisionError(403, body), /APIの制限/);
});

test("使える場所の制限で弾かれたとき、なしにするよう案内する", () => {
  const body = JSON.stringify({
    error: { code: 403, details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }] },
  });
  assert.match(explainVisionError(403, body), /アプリケーションの制限/);
});

test("合いことば自体がまちがっているとき、写し間違いを疑うよう言う", () => {
  const body = JSON.stringify({
    error: { code: 400, message: "API key not valid. Please pass a valid API key.", details: [{ reason: "API_KEY_INVALID" }] },
  });
  assert.match(explainVisionError(400, body), /写し間違い/);
});

test("読み解けない返事でも、Googleの文面をそのまま見せる", () => {
  const body = JSON.stringify({ error: { code: 500, message: "Internal error occurred" } });
  assert.match(explainVisionError(500, body), /Internal error occurred/);
});

test("JSONでない返事でも落ちない", () => {
  const msg = explainVisionError(502, "<html>Bad Gateway</html>");
  assert.ok(msg.length > 0);
});
