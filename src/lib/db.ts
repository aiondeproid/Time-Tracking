import "server-only";

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

/**
 * SQLite データベース（Node.js 標準の `node:sqlite`）。
 *
 * - 保存先は環境変数 `DATABASE_PATH`（既定: `<プロジェクト>/data/kintai.db`）。
 * - 初回接続時にスキーマを自動作成・更新する（`PRAGMA user_version` で版管理）。
 * - 時刻は UTC の ISO 文字列（`Date#toISOString()` 形式）で保存する。
 *   表示・勤務日判定は従来どおり Asia/Tokyo で行う（[[time]]）。
 *
 * `node:sqlite` はバンドラーに解決させず `process.getBuiltinModule` で実行時に
 * 読み込む（Next.js のバンドル対象から外すため）。
 */

type Db = DatabaseSyncType;

const globalForDb = globalThis as unknown as { __kintaiDb?: Db };

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), "data", "kintai.db");
}

/**
 * スキーマのマイグレーション。配列の i 番目を適用すると user_version = i + 1。
 * 既存の DB には未適用の分だけ順に流す。後から変更する場合は末尾に追加すること。
 */
const MIGRATIONS: string[] = [
  // 1: 初期スキーマ（旧 Supabase の members / attendance ＋ ログイン用 users / sessions）
  `
  CREATE TABLE members (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE,
    reading    TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );

  CREATE TABLE attendance (
    id           TEXT PRIMARY KEY,
    member_id    TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    work_date    TEXT NOT NULL,
    clock_in_at  TEXT NOT NULL,
    clock_out_at TEXT,
    note         TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );
  CREATE INDEX attendance_work_date_idx        ON attendance (work_date);
  CREATE INDEX attendance_member_work_date_idx ON attendance (member_id, work_date);

  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    login_id      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user_idx ON sessions (user_id);
  `,
  // 2: ID + パスワードのログインを廃止し、管理用コード（SIGNUP_CODE）だけで入る方式へ。
  //    code_hash = ログインした時点のコードの指紋。コードを変えると既存セッションは無効になる。
  `
  DROP TABLE sessions;
  DROP TABLE users;

  CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
];

function migrate(db: Db): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const current = Number(row.user_version);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

function open(): Db {
  const sqlite = process.getBuiltinModule("node:sqlite") as
    | typeof import("node:sqlite")
    | undefined;
  if (!sqlite) {
    throw new Error(
      "node:sqlite が利用できません。Node.js 22.13 以上（推奨: 24 LTS）で起動してください。",
    );
  }

  const file = resolveDbPath();
  mkdirSync(path.dirname(file), { recursive: true });

  const db = new sqlite.DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  migrate(db);
  return db;
}

/** アプリ全体で共有する DB 接続（開発時のホットリロードでも 1 つに保つ）。 */
export function getDb(): Db {
  if (!globalForDb.__kintaiDb) globalForDb.__kintaiDb = open();
  return globalForDb.__kintaiDb;
}

/** 複数の書き込みを 1 トランザクションで実行する。例外時はロールバック。 */
export function transaction<T>(fn: (db: Db) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** 現在時刻（UTC ISO 文字列）。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 新しい ID（UUID v4）。 */
export function newId(): string {
  return randomUUID();
}

/** 時刻文字列を保存用の正規形（`toISOString()`）にそろえる。並び替えを文字列比較で正しく行うため。 */
export function normalizeIso(value: string): string {
  return new Date(value).toISOString();
}

/** UNIQUE 制約違反か。 */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}
