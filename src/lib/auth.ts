import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb, nowIso } from "@/lib/db";
import { GLOBAL_LOCK_MS, GLOBAL_MAX_FAILURES, LoginThrottle } from "@/lib/login-throttle";

/**
 * 「名前の管理」のログイン（管理用コード `SIGNUP_CODE` を入力するだけ）。
 *
 * - ログイン状態は `admin_sessions` テーブル + HttpOnly Cookie。Cookie にはランダムな
 *   トークンを入れ、DB にはその SHA-256 だけを保存する。
 * - セッションにはログイン時点のコードの指紋（code_hash）を記録し、照合時に現在の
 *   コードと比べる。コードを変更すると、ログイン中の全員が自動的にログアウトされる。
 * - 総当たり対策として、接続元ごとに失敗回数を数えてロックする（[[login-throttle]]）。
 */

export const SESSION_COOKIE = "kintai_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 日

// 開発サーバーのホットリロードでも失敗回数を保つため globalThis に置く。
// 中身の形を変えたときはキー名も変えること（古い形のオブジェクトが残っていると壊れるため）。
const globalForThrottle = globalThis as unknown as {
  __kintaiLoginThrottlesV2?: { perClient: LoginThrottle; global: LoginThrottle };
};
const throttles = (globalForThrottle.__kintaiLoginThrottlesV2 ??= {
  perClient: new LoginThrottle(),
  global: new LoginThrottle(GLOBAL_MAX_FAILURES, GLOBAL_LOCK_MS),
});
const GLOBAL_KEY = "*";

/**
 * ロック中なら残りミリ秒（接続元ごと・全体の長い方）、そうでなければ 0。
 */
export function loginLockedFor(key: string): number {
  return Math.max(throttles.perClient.lockedFor(key), throttles.global.lockedFor(GLOBAL_KEY));
}

/** コード違いを記録する。 */
export function recordLoginFailure(key: string): void {
  throttles.perClient.recordFailure(key);
  throttles.global.recordFailure(GLOBAL_KEY);
}

/** ログイン成功を記録する（接続元の失敗回数だけリセット。全体の回数は時間で消える）。 */
export function recordLoginSuccess(key: string): void {
  throttles.perClient.recordSuccess(key);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 現在の管理用コードの指紋。未設定なら null（誰もログインできない）。 */
function currentCodeHash(): string | null {
  const code = process.env.SIGNUP_CODE ?? "";
  return code.length > 0 ? sha256(`kintai-admin:${code}`) : null;
}

/** HTTPS で公開する場合だけ `SESSION_COOKIE_SECURE=true` にする（社内 HTTP では false）。 */
function cookieSecure(): boolean {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

/** ログイン済み（有効なセッションがある）か。 */
export async function isLoggedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const codeHash = currentCodeHash();
  if (!token || !codeHash) return false;

  const row = getDb()
    .prepare(
      "SELECT 1 FROM admin_sessions WHERE token_hash = ? AND code_hash = ? AND expires_at > ?",
    )
    .get(sha256(token), codeHash, nowIso());
  return row !== undefined;
}

/** ログイン必須。未ログインなら `/login` へリダイレクトする。 */
export async function requireLogin(nextPath = "/members"): Promise<void> {
  if (!(await isLoggedIn())) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}

/** 総当たり対策で使う接続元の識別子（IP アドレス）。 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/** セッションを発行して Cookie に保存する（Server Action / Route Handler からのみ）。 */
export async function startSession(): Promise<void> {
  const codeHash = currentCodeHash();
  if (!codeHash) throw new Error("SIGNUP_CODE が設定されていません。");

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000);

  const db = getDb();
  // 期限切れ・古いコードのセッションを掃除する。
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ? OR code_hash <> ?").run(
    now.toISOString(),
    codeHash,
  );
  db.prepare(
    "INSERT INTO admin_sessions (token_hash, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(sha256(token), codeHash, expires.toISOString(), now.toISOString());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/** 現在のセッションを破棄して Cookie を消す。 */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256(token));
  }
  store.delete(SESSION_COOKIE);
}
