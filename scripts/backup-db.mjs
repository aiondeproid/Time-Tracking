// SQLite データベースのバックアップ。
//
// 使い方（プロジェクトのフォルダで）:  npm run backup
//
// - アプリを動かしたままでも安全にコピーできる（SQLite の `VACUUM INTO` で整合性のある複製を作る）。
// - 保存先: 環境変数 BACKUP_DIR（既定: <プロジェクト>/backup）。共有フォルダ（\\server\share\kintai など）も可。
// - 世代数: 環境変数 BACKUP_KEEP（既定: 30）。古いものから自動で削除する。
// - DB の場所はアプリと同じく DATABASE_PATH（既定: <プロジェクト>/data/kintai.db）。
// - `.env.local` があれば読み込む。
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const dbPath = process.env.DATABASE_PATH?.trim()
  ? path.resolve(root, process.env.DATABASE_PATH.trim())
  : path.join(root, "data", "kintai.db");
const backupDir = process.env.BACKUP_DIR?.trim()
  ? path.resolve(root, process.env.BACKUP_DIR.trim())
  : path.join(root, "backup");
const keep = Math.max(1, Number.parseInt(process.env.BACKUP_KEEP ?? "30", 10) || 30);

if (!existsSync(dbPath)) {
  console.error(`[backup] DB ファイルが見つかりません: ${dbPath}`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });

const p = (n) => String(n).padStart(2, "0");
const d = new Date();
const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
const dest = path.join(backupDir, `kintai-${stamp}.db`);

const db = new DatabaseSync(dbPath);
try {
  db.exec("PRAGMA busy_timeout = 10000");
  db.prepare("VACUUM INTO ?").run(dest);
} finally {
  db.close();
}

// 書き出したファイルが壊れていないか確認する。
const check = new DatabaseSync(dest, { readOnly: true });
try {
  const result = check.prepare("PRAGMA integrity_check").get();
  if (result?.integrity_check !== "ok") {
    console.error(`[backup] 整合性チェックに失敗しました: ${JSON.stringify(result)}`);
    process.exit(1);
  }
} finally {
  check.close();
}

// 古い世代を削除する。
const old = readdirSync(backupDir)
  .filter((f) => /^kintai-\d{8}-\d{6}\.db$/.test(f))
  .sort()
  .reverse()
  .slice(keep);
for (const f of old) rmSync(path.join(backupDir, f));

console.log(`[backup] 作成: ${dest}`);
if (old.length > 0) console.log(`[backup] 古いバックアップを ${old.length} 件削除（${keep} 世代を保持）`);
