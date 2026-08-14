import { prisma } from "./db";
import { decryptJson, encryptJson, isEncryptionReady } from "./crypto";

/**
 * 外部サービスとのつながりを一箇所で管理する。
 *
 * 合いことばを環境変数ではなくDBに置くのは、画面からつなぎ替えられるようにするため。
 * 「いまは自分の公式アカウント、あとでお客さま側のアカウントへ」という乗り換えを、
 * 再デプロイなしで行えるようにしている。
 */

export type Provider = "line" | "google_calendar" | "google_vision";

export type ConnectionStatus = "connected" | "error" | "disconnected";

export type ConnectionView = {
  provider: Provider;
  connected: boolean;
  status: ConnectionStatus;
  label: string | null;
  connectedAt: Date | null;
  connectedBy: string | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  config: Record<string, unknown>;
  /** 環境変数から読んでいる場合は true（画面からは変えられない） */
  fromEnv: boolean;
};

/* ---------------- 読み出し ---------------- */

/**
 * 合いことばを取り出す。画面から設定した値（DB）を優先し、
 * 無ければ環境変数を見る。環境変数は開発時と、移行期間のための逃げ道。
 */
export async function getCredentials<T>(
  provider: Provider,
  envFallback: () => T | null
): Promise<{ credentials: T | null; fromEnv: boolean }> {
  if (isEncryptionReady()) {
    const row = await prisma.connection.findUnique({ where: { provider } });
    if (row && row.status !== "disconnected") {
      try {
        return { credentials: decryptJson<T>(row.credentials), fromEnv: false };
      } catch {
        // 鍵が変わった等で読めない場合は環境変数へ落とす
      }
    }
  }
  const fromEnvValue = envFallback();
  return { credentials: fromEnvValue, fromEnv: fromEnvValue !== null };
}

export async function getConnection(
  provider: Provider,
  envFallback: () => boolean
): Promise<ConnectionView> {
  const row = await prisma.connection.findUnique({ where: { provider } });

  if (row && row.status !== "disconnected") {
    return {
      provider,
      connected: row.status === "connected",
      status: row.status as ConnectionStatus,
      label: row.label,
      connectedAt: row.connectedAt,
      connectedBy: row.connectedBy,
      lastCheckedAt: row.lastCheckedAt,
      lastError: row.lastError,
      config: safeParse(row.config),
      fromEnv: false,
    };
  }

  const envConnected = envFallback();
  return {
    provider,
    connected: envConnected,
    status: envConnected ? "connected" : "disconnected",
    label: envConnected ? "環境変数で設定されています" : null,
    connectedAt: null,
    connectedBy: null,
    lastCheckedAt: null,
    lastError: null,
    config: {},
    fromEnv: envConnected,
  };
}

/* ---------------- 書き込み ---------------- */

export async function saveConnection(params: {
  provider: Provider;
  credentials: unknown;
  label?: string | null;
  config?: Record<string, unknown>;
  actorName?: string | null;
}): Promise<void> {
  const existing = await prisma.connection.findUnique({ where: { provider: params.provider } });
  const encrypted = encryptJson(params.credentials);

  await prisma.connection.upsert({
    where: { provider: params.provider },
    create: {
      provider: params.provider,
      credentials: encrypted,
      status: "connected",
      label: params.label ?? null,
      connectedBy: params.actorName ?? null,
      config: JSON.stringify(params.config ?? {}),
      lastCheckedAt: new Date(),
      lastError: null,
    },
    update: {
      credentials: encrypted,
      status: "connected",
      label: params.label ?? null,
      connectedBy: params.actorName ?? null,
      connectedAt: new Date(),
      config: JSON.stringify(params.config ?? {}),
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  await log(
    params.provider,
    existing ? "reconnected" : "connected",
    params.label ?? null,
    params.actorName
  );
}

/** 秘密でない付随設定（書き出し先カレンダーなど）だけを更新する */
export async function updateConnectionConfig(
  provider: Provider,
  patch: Record<string, unknown>
): Promise<void> {
  const row = await prisma.connection.findUnique({ where: { provider } });
  if (!row) return;
  const next = { ...safeParse(row.config), ...patch };
  await prisma.connection.update({
    where: { provider },
    data: { config: JSON.stringify(next) },
  });
}

export async function disconnect(provider: Provider, actorName?: string | null): Promise<void> {
  await prisma.connection.deleteMany({ where: { provider } });
  await log(provider, "disconnected", null, actorName);
}

/** 疎通確認の結果を記録する。定時実行から呼ばれ、切れていれば画面に出す。 */
export async function markConnectionResult(
  provider: Provider,
  result: { ok: true } | { ok: false; error: string }
): Promise<void> {
  const row = await prisma.connection.findUnique({ where: { provider } });
  if (!row) return;

  await prisma.connection.update({
    where: { provider },
    data: {
      status: result.ok ? "connected" : "error",
      lastCheckedAt: new Date(),
      lastError: result.ok ? null : result.error.slice(0, 500),
    },
  });

  if (!result.ok) await log(provider, "check_failed", result.error.slice(0, 300), null);
}

export async function connectionHistory(provider: Provider, take = 10) {
  return prisma.connectionLog.findMany({
    where: { provider },
    orderBy: { createdAt: "desc" },
    take,
  });
}

async function log(
  provider: Provider,
  action: string,
  detail: string | null,
  actorName?: string | null
) {
  await prisma.connectionLog.create({
    data: { provider, action, detail, actorName: actorName ?? null },
  });
}

function safeParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
