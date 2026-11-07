import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb, newId, nowIso } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * 「名前の管理」のログイン（アプリ自前の ID + パスワード）。
 *
 * - アカウントは SQLite の `users` テーブル。パスワードは scrypt でハッシュ化（[[password]]）。
 * - ログイン状態は `sessions` テーブル + HttpOnly Cookie。Cookie にはランダムな
 *   トークンを入れ、DB にはその SHA-256 だけを保存する（DB が漏れても乗っ取れない）。
 */

export type SessionUser = { id: string; loginId: string };

export const SESSION_COOKIE = "kintai_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 日

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** HTTPS で公開する場合だけ `SESSION_COOKIE_SECURE=true` にする（社内 HTTP では false）。 */
function cookieSecure(): boolean {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

/** ログイン中のユーザーを返す。未ログイン・期限切れなら null。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .prepare(
      `SELECT u.id AS id, u.login_id AS loginId
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), nowIso()) as SessionUser | undefined;
  return row ? { id: row.id, loginId: row.loginId } : null;
}

/** ログイン必須。未ログインなら `/login` へリダイレクトする。 */
export async function requireUser(nextPath = "/members"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** セッションを発行して Cookie に保存する（Server Action / Route Handler からのみ）。 */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000);

  const db = getDb();
  // ついでに期限切れセッションを掃除する。
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, expires.toISOString(), now.toISOString());

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
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }
  store.delete(SESSION_COOKIE);
}

/** ログイン ID とパスワードを照合し、正しければユーザー ID を返す。 */
export async function authenticate(loginId: string, password: string): Promise<string | null> {
  const row = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE login_id = ?")
    .get(loginId) as { id: string; password_hash: string } | undefined;
  if (!row) {
    // ID の有無で応答時間が変わらないよう、ダミーでもハッシュ計算はしておく。
    await hashPassword(password);
    return null;
  }
  return (await verifyPassword(password, row.password_hash)) ? row.id : null;
}

/** ユーザーを作成する。ログイン ID が使用済みなら null。 */
export async function createUser(loginId: string, password: string): Promise<string | null> {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM users WHERE login_id = ?").get(loginId);
  if (exists) return null;

  const id = newId();
  db.prepare(
    "INSERT INTO users (id, login_id, password_hash, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, loginId, await hashPassword(password), nowIso());
  return id;
}
