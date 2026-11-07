# 勤怠管理アプリ

紙ベースの勤怠管理を置き換える社内向け Web アプリ。出勤・退勤の時刻を記録し、
任意の期間を指定して書式付き Excel としてダウンロードできる。

社内の PC（またはサーバー）1 台で動かす構成。外部のクラウドサービスには依存せず、
データは SQLite のファイル 1 つに保存する。

確定仕様は [`docs/仕様.md`](docs/仕様.md)（※ Supabase / Vercel / 合言葉ゲートに関する記述は
この README の構成に置き換え済み）。

## 主な機能

- **勤怠入力** `/attendance` — 名前を選んで [出勤] / [退勤]。1 分単位・丸めなし。
  1 日に複数回の出退勤が可能。深夜 4:00 より前の出勤は前日の勤務日になる（手修正可）。
- **勤怠一覧** `/list` — 期間（勤務日 from〜to、初期値は当月）と名前で絞り込み。
  行の編集・削除。深夜の時刻は 24 時間超え表記（例: 28:00）。
- **Excel 書き出し** — 一覧と同じ条件で書式付き `.xlsx`（見出し固定・罫線・合計行）。
- **名前の管理** `/members` — ログイン ID + パスワードで保護。
  追加 / 名前編集 / 表示順 / アーカイブ（物理削除しない）。Excel・CSV の一括取り込み
  （UTF-8 / Shift_JIS 自動判定、プレビュー → 確定）。テンプレート配布。

勤怠入力・一覧・Excel 書き出しはログイン不要（利用者は自分の名前を選んで操作する）。
「名前の管理」だけはログインが必要で、アカウント登録には招待コード（`SIGNUP_CODE`）を要求する。

## 技術構成

| | |
|---|---|
| フレームワーク | Next.js 16（App Router） / TypeScript |
| スタイル | Tailwind CSS v4 |
| DB | SQLite（Node.js 標準の `node:sqlite`。追加のネイティブモジュール不要） |
| 認証 | 自前の ID + パスワード（scrypt でハッシュ化）＋ DB セッション / HttpOnly Cookie |
| Excel | `exceljs` |
| CSV | `papaparse` + `encoding-japanese`（Shift_JIS 対応） |
| バリデーション | `zod` |
| 日時 | `dayjs`（`utc` / `timezone` プラグイン、Asia/Tokyo 固定） |
| テスト | Vitest |

時刻は DB に UTC の ISO 文字列で保存し、表示・入力・勤務日判定はすべて
日本時間（Asia/Tokyo）で行う。

## セットアップ

### 前提

- Node.js **22.13 以上**（推奨: 24 LTS）。`node:sqlite` を使うため。

### 手順

```powershell
npm install
Copy-Item .env.local.example .env.local   # 値を埋める（下記）
npm run dev                               # http://localhost:3000
```

DB の準備は不要。初回アクセス時に `data/kintai.db` とテーブルが自動で作られる。

最初に `/signup` で「名前の管理」用のアカウントを作成する（`SIGNUP_CODE` が必要）。

### スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー（要 `build`） |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest（勤務日判定・24 時間超え表記・パスワード・登録用コード・取り込みパーサ 等） |

## 環境変数

`.env.local` に設定する。

| 変数 | 用途 | 必須 |
|---|---|---|
| `SIGNUP_CODE` | 「名前の管理」のアカウント登録に要求する招待コード | 登録するなら必須 |
| `DATABASE_PATH` | SQLite ファイルの保存先（既定: `data/kintai.db`） | 任意 |
| `SESSION_COOKIE_SECURE` | `true` でログイン Cookie に Secure 属性を付ける（HTTPS 公開時のみ） | 任意 |

- `SIGNUP_CODE` を変更しても既存アカウントには影響しない（新規登録時のみ照合）。
  未設定だと `/signup` は無効になる（既存アカウントのログインは可能）。
- 社内ネットワークで `http://` のまま使う場合、`SESSION_COOKIE_SECURE` は設定しないこと
  （`true` にすると HTTP ではログインできなくなる）。

## 社内 PC での運用

### 初回セットアップ

```powershell
npm install
npm run build
Copy-Item .env.local.example .env.local   # SIGNUP_CODE を設定
```

### 自動起動 + 毎日のバックアップを登録

**管理者として** PowerShell を開き、プロジェクトのフォルダで実行する。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
```

| 登録されるもの | 内容 |
|---|---|
| タスク `KintaiKanri-Server` | PC 起動時にアプリを開始（ログイン不要）。異常終了したら 1 分後に再起動 |
| タスク `KintaiKanri-Backup` | 毎日 3:00 に DB をバックアップ |
| ファイアウォール規則 | TCP 3000 の受信を許可（ドメイン / プライベート ネットワーク） |

オプション: `-Port 8080`（ポート変更）、`-BackupTime 12:30`（バックアップ時刻）、
`-RunAs User`（管理者権限がない場合。このユーザーのログイン時に起動、ファイアウォールは別途依頼）。

他の PC からは `http://<この PC の名前 or IP>:3000` で開く。ログは `logs\server.log`。
登録を取り消すときは `scripts\windows\uninstall-autostart.ps1`（データは消えない）。

### バックアップ

```powershell
npm run backup     # 手動で今すぐバックアップ
```

- アプリを動かしたままでも安全にコピーできる（SQLite の `VACUUM INTO`）。
- 保存先は `backup\kintai-YYYYMMDD-HHmmss.db`。30 世代を残して古いものは自動削除。
- `.env.local` の `BACKUP_DIR`（例: `\\fileserver\share\kintai`）で別の PC・共有フォルダに、
  `BACKUP_KEEP` で世代数を変えられる。**PC の故障に備えて、別の場所に保存するのがおすすめ。**
  ただし `-RunAs System` で登録した場合、バックアップは PC のコンピューター アカウントで実行されるため、
  共有フォルダ側でそのアカウント（`<ドメイン>\<PC 名>$`）に書き込み権限が必要。

**復元するとき**: アプリを止め（タスク スケジューラで `KintaiKanri-Server` を終了）、
`data\kintai.db-wal` と `data\kintai.db-shm` を削除してから、戻したいバックアップを
`data\kintai.db` という名前で上書きコピーし、アプリを再起動する。

### アプリを更新するとき

```powershell
git pull
npm install
npm run build
Stop-ScheduledTask KintaiKanri-Server; Start-ScheduledTask KintaiKanri-Server   # 管理者 PowerShell で
```

### 運用上の注意

- PC のスリープ・自動シャットダウンを無効にする。
- IP アドレス（または PC 名）を固定する。
- 個人 PC をサーバー代わりにしてよいか、社内のルールを情シスに確認しておく。

## ディレクトリ構成（抜粋）

```
src/
  app/
    (app)/            共通ナビ配下の画面（/、/attendance、/list、/members）
    api/
      export/         GET  勤怠一覧の .xlsx 生成
      members/import  POST 名前リストの取り込み（preview / commit）
      members/template GET テンプレート配布
    login/ signup/    「名前の管理」のログイン / ユーザー登録ページ
  proxy.ts            /members にログイン Cookie なしで来たら /login へ
  lib/
    db.ts             SQLite 接続・スキーマ自動作成（PRAGMA user_version で版管理）
    time.ts           日本時間・勤務日（4:00 境界）・24 時間超え表記
    auth.ts / auth-actions.ts  ログイン状態・セッション / login・signup・logout の Server Action
    password.ts       パスワードのハッシュ化（scrypt）
    signup-code.ts    ユーザー登録の招待コード（SIGNUP_CODE）照合
    attendance*.ts    勤怠の取得・Server Action
    members*.ts       メンバーの取得・変更・取り込みパーサ
    excel.ts          exceljs の帳票組み立て
data/                 SQLite の DB ファイル（.gitignore 済み）
```

## 運用メモ

- **メンバーの「削除」はアーカイブ**（`active = 0`）。過去の勤怠は保持され、
  一覧・Excel には引き続き表示される。勤怠入力の名前選択には出なくなる。
- 取り込みは「名前」をキーに **追加 + 更新のみ**。ファイルに無い名前は変更しない。
- スキーマを変更するときは `src/lib/db.ts` の `MIGRATIONS` の末尾に追加する
  （既存の DB には未適用の分だけ自動で流れる）。

## 既知の未対応 / 将来拡張

`docs/仕様.md` の「14. 未決定・将来拡張」を参照（勤務区分、休憩時間、祝日カレンダー、
安定した社員識別子、メンバー別シートの Excel 出力 など）。
