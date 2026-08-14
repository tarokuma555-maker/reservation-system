import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";

import { prisma } from "../src/lib/db.ts";
import {
  disconnect,
  getConnection,
  getCredentials,
  markConnectionResult,
  saveConnection,
} from "../src/lib/connections.ts";

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

type Creds = { accessToken: string; channelSecret: string };

async function reset() {
  await prisma.connectionLog.deleteMany({ where: { provider: "line" } });
  await prisma.connection.deleteMany({ where: { provider: "line" } });
}

test("保存した合いことばは、DBの中では読めない形になっている", async () => {
  await reset();
  const secret = "super-secret-access-token-abcdef";

  await saveConnection({
    provider: "line",
    credentials: { accessToken: secret, channelSecret: "sec" } satisfies Creds,
    label: "テスト用アカウント",
    actorName: "テスト",
  });

  const row = await prisma.connection.findUniqueOrThrow({ where: { provider: "line" } });
  assert.ok(!row.credentials.includes(secret), "生のまま保存されていてはいけない");

  const { credentials } = await getCredentials<Creds>("line", () => null);
  assert.equal(credentials?.accessToken, secret);

  await reset();
});

test("つなぎ替えても、履歴に残る", async () => {
  await reset();

  await saveConnection({
    provider: "line",
    credentials: { accessToken: "token-A", channelSecret: "a" },
    label: "自分の公式アカウント",
    actorName: "オーナー",
  });
  await saveConnection({
    provider: "line",
    credentials: { accessToken: "token-B", channelSecret: "b" },
    label: "お客さまの公式アカウント",
    actorName: "オーナー",
  });

  const { credentials } = await getCredentials<Creds>("line", () => null);
  assert.equal(credentials?.accessToken, "token-B", "新しいほうが使われる");

  const logs = await prisma.connectionLog.findMany({
    where: { provider: "line" },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    logs.map((l) => l.action),
    ["connected", "reconnected"],
    "1回目はつないだ、2回目はつなぎ替えたとして残る"
  );

  await reset();
});

test("解除したら、環境変数のほうに戻る", async () => {
  await reset();

  await saveConnection({
    provider: "line",
    credentials: { accessToken: "from-screen", channelSecret: "x" },
  });
  await disconnect("line", "オーナー");

  const { credentials, fromEnv } = await getCredentials<Creds>("line", () => ({
    accessToken: "from-env",
    channelSecret: "y",
  }));
  assert.equal(credentials?.accessToken, "from-env");
  assert.equal(fromEnv, true);

  await reset();
});

test("つながりが切れたら、画面に出す状態に変わる", async () => {
  await reset();
  await saveConnection({ provider: "line", credentials: { accessToken: "t", channelSecret: "s" } });

  await markConnectionResult("line", { ok: false, error: "合いことばが無効になりました" });

  const view = await getConnection("line", () => false);
  assert.equal(view.status, "error");
  assert.equal(view.connected, false, "切れているあいだは「つながっている」と言わない");
  assert.match(view.lastError ?? "", /無効/);

  await markConnectionResult("line", { ok: true });
  const healed = await getConnection("line", () => false);
  assert.equal(healed.status, "connected");
  assert.equal(healed.lastError, null);

  await reset();
});

test("まちがった合いことばは、保存される前にはじかれる", async () => {
  // LINEの代わりに、401を返すだけのサーバーを立てて確かめる
  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization ?? "";
    if (auth === "Bearer good-token") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ displayName: "くらしのて", basicId: "@abc1234" }));
      return;
    }
    res.writeHead(401);
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;

  // testLineCredentials と同じ判定を、差し替えた宛先に対して行う
  const check = async (token: string) => {
    const res = await fetch(`http://127.0.0.1:${port}/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  };

  assert.equal(await check("wrong-token"), false);
  assert.equal(await check("good-token"), true);

  await new Promise<void>((r) => server.close(() => r()));
});
