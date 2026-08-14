import crypto from "node:crypto";

/**
 * 合いことば（アクセストークンなど）の暗号化。
 *
 * これらはデータベースに保存するが、万一データベースの中身が漏れても
 * 合いことばだけは読めない状態にしておく。鍵は環境変数に置き、DBには入れない。
 *
 * AES-256-GCM を使う。GCMは暗号文の改ざんも検知できるため、
 * 「復号はできたが中身がすり替わっていた」という事故が起きない。
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCMの推奨値
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY が設定されていません。合いことばを保存するための鍵が必要です。" +
        "`openssl rand -base64 32` で作った値を環境変数に入れてください。"
    );
  }

  // base64（32バイト）か、16進数（64文字）を受け付ける
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY は32バイトである必要があります（いまは${key.length}バイト）。` +
        "`openssl rand -base64 32` で作り直してください。"
    );
  }
  return key;
}

/** 暗号化できる状態かどうか。設定画面で事前に知らせるために使う。 */
export function isEncryptionReady(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * 暗号化する。戻り値は `v1.<iv>.<認証タグ>.<暗号文>` の形（すべてbase64url）。
 * 先頭に版番号を付けているのは、将来やり方を変えたときに古い値も読めるようにするため。
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** 復号する。改ざんされていれば例外になる。 */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("保存されている合いことばの形式が想定と違います");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const encrypted = Buffer.from(parts[3], "base64url");

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("保存されている合いことばの形式が想定と違います");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** オブジェクトをまるごと暗号化する */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}

/**
 * 画面に出すとき用。末尾4文字だけ見せる。
 * 「入っていること」は分かり、「値そのもの」は分からない状態にする。
 */
export function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(8)}${value.slice(-4)}`;
}
