# 勤怠管理アプリ

紙ベースの勤怠管理を置き換える社内向け Web アプリ。出勤・退勤の時刻を記録し、
任意の期間を指定して書式付き Excel としてダウンロードできる。

確定仕様は [`docs/仕様.md`](docs/仕様.md)。

## 主な機能

- **勤怠入力** `/attendance` — 名前を選んで [出勤] / [退勤]。1 分単位・丸めなし。
  1 日に複数回の出退勤が可能。深夜 4:00 より前の出勤は前日の勤務日になる（手修正可）。
- **勤怠一覧** `/list` — 期間（勤務日 from〜to、初期値は当月）と名前で絞り込み。
  行の編集・削除。深夜の時刻は 24 時間超え表記（例: 28:00）。
- **Excel 書き出し** — 一覧と同じ条件で書式付き `.xlsx`（見出し固定・罫線・合計行）。
- **名前の管理** `/members` — ユーザー登録＋ログイン（Supabase Auth / メール + パスワード）で保護。
  追加 / 名前編集 / 表示順 / アーカイブ（物理削除しない）。Excel・CSV の一括取り込み
  （UTF-8 / Shift_JIS 自動判定、プレビュー → 確定）。テンプレート配布。
- **サイト共通合言葉ゲート** — 全ページを署名付き Cookie で保護（社内限定運用）。

勤怠入力・一覧・Excel 書き出しはログイン不要（利用者はトップで自分の名前を選んで操作する）。
「名前の管理」だけはログインが必要で、登録には招待コード（`SIGNUP_CODE`）を要求する。

## 技術構成

| | |
|---|---|
| フレームワーク | Next.js 16（App Router） / TypeScript |
| スタイル | Tailwind CSS v4 |
| DB | Supabase（PostgreSQL） / `@supabase/supabase-js` v2 |
| 認証 | Supabase Auth（「名前の管理」のみ） / `@supabase/ssr`（Cookie セッション） |
| Excel | `exceljs` |
| CSV | `papaparse` + `encoding-japanese`（Shift_JIS 対応） |
| バリデーション | `zod` |
| 日時 | `dayjs`（`utc` / `timezone` プラグイン、Asia/Tokyo 固定） |
| テスト | Vitest |
| ホスティング | Vercel |

時刻は DB に UTC の `timestamptz` で保存し、表示・入力・勤務日判定はすべて
日本時間（Asia/Tokyo）で行う。

## セットアップ（ローカル）

### 前提

- Node.js 20.9 以上
- Supabase プロジェクト（無料枠で可）

### 手順

```bash
npm install
cp .env.local.example .env.local   # 値を埋める（下記）
```

Supabase のスキーマを適用する。詳細は [`supabase/README.md`](supabase/README.md)。

- 最短: Supabase ダッシュボードの **SQL Editor** に
  [`supabase/migrations/20260903000001_init.sql`](supabase/migrations/20260903000001_init.sql)
  を貼り付けて実行。
- 動作確認用のダミーメンバーが欲しければ
  [`supabase/seed.sql`](supabase/seed.sql) も実行（任意）。

### Supabase Auth（「名前の管理」のログイン）

DB スキーマの変更やマイグレーションは不要（`auth` スキーマは Supabase が用意する）。
ダッシュボードで以下だけ確認する。

- **Authentication → Sign In / Providers → Email**: 有効（既定のまま）。
- **Authentication → Sign-ups → Allow new users to sign up**: 無効で可。
  ユーザー作成はサーバー側が `service_role`（`admin.createUser`）で行うため、
  公開サインアップは使わない。アクセス制御は `SIGNUP_CODE` が担う。
- 確認メール（Confirm email）・SMTP の設定は不要。作成時に `email_confirm: true`
  で確定させ、確認メールは送らない。

開発サーバー:

```bash
npm run dev       # http://localhost:3000
```

最初にサイト共通合言葉（`SITE_PASSCODE`）の入力を求められる。「名前の管理」を開くと
さらにログインを求められる。アカウントは `/signup` で作成（`SIGNUP_CODE` が必要）。

### スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー（要 `build`） |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest（勤務日判定・24 時間超え表記・合言葉・登録用コード・取り込みパーサ 等） |

## 環境変数

`.env.local`（ローカル）と Vercel のプロジェクト設定に、以下 5 つをすべて設定する。

| 変数 | 用途 | 公開範囲 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | クライアント可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable キー | クライアント可 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー側の members 変更・取り込み・ユーザー作成 | **サーバーのみ** |
| `SIGNUP_CODE` | 「名前の管理」のユーザー登録に要求する招待コード | **サーバーのみ** |
| `SITE_PASSCODE` | サイト共通合言葉ゲート（署名鍵もこの値から導出） | **サーバーのみ** |

- `SUPABASE_SERVICE_ROLE_KEY` は全権限を持つ。絶対に `NEXT_PUBLIC_` を付けない。
- `SITE_PASSCODE` を変更すると、発行済みのゲート用セッション Cookie はすべて無効になる
  （利用者は再入力が必要）。
- `SIGNUP_CODE` を変更しても既存アカウントには影響しない（新規登録時のみ照合）。
  未設定だと `/signup` は無効化される（既存アカウントのログインは可能）。

## デプロイ（Vercel）

1. GitHub リポジトリを Vercel にインポート（フレームワークは Next.js が自動検出される）。
2. **Settings → Environment Variables** に上記 5 変数を設定
   （`SUPABASE_SERVICE_ROLE_KEY` / `SIGNUP_CODE` / `SITE_PASSCODE` は Production /
   Preview のみで可。ブラウザに出したくないので `NEXT_PUBLIC_` を付けないこと）。
3. Supabase 側でマイグレーション（[`supabase/README.md`](supabase/README.md)）を適用し、
   Supabase Auth の設定を確認（[Supabase Auth](#supabase-auth名前の管理のログイン)）。
   本番とプレビューで DB を分けたい場合は Supabase プロジェクトを 2 つ用意し、
   環境ごとに URL / キーを設定する。
4. デプロイ。ビルドコマンド・出力ディレクトリは既定のままで動く。
5. デプロイ後、`/signup` で最初の管理担当者アカウントを作成する（`SIGNUP_CODE` が必要）。

補足:

- Excel 生成・ファイル取り込みの Route Handler は Node ランタイム
  （`export const runtime = "nodejs"`）。`exceljs` は `next.config.ts` の
  `serverExternalPackages` に指定済み。
- 時刻は Asia/Tokyo をコードで固定しているため、サーバーのリージョン設定に依存しない。

## ディレクトリ構成（抜粋）

```
src/
  app/
    (app)/            共通ナビ配下の画面（/、/attendance、/list、/members）
    api/
      export/         GET  勤怠一覧の .xlsx 生成
      members/import  POST 名前リストの取り込み（preview / commit）
      members/template GET テンプレート配布
    gate/             サイト共通合言葉の入力ページ
    login/ signup/    「名前の管理」のログイン / ユーザー登録ページ
  proxy.ts            サイト共通合言葉ゲート ＋ /members のログイン誘導
  lib/
    time.ts           日本時間・勤務日（4:00 境界）・24 時間超え表記
    gate.ts           サイト共通合言葉の署名付き Cookie の発行・検証
    auth.ts / auth-actions.ts  ログイン状態の取得 / login・signup・logout の Server Action
    signup-code.ts    ユーザー登録の招待コード（SIGNUP_CODE）照合
    attendance*.ts    勤怠の取得・Server Action
    members*.ts        メンバーの取得・変更・取り込みパーサ
    excel.ts          exceljs の帳票組み立て
    supabase/         ブラウザ用 / サービスロール用 / Auth（Cookie）用クライアント
supabase/
  migrations/         スキーマ・RLS ポリシー
```

## 運用メモ

- **メンバーの「削除」はアーカイブ**（`active = false`）。過去の勤怠は保持され、
  一覧・Excel には引き続き表示される。勤怠入力の名前選択には出なくなる。
- 取り込みは「名前」をキーに **追加 + 更新のみ**。ファイルに無い名前は変更しない。
- `exceljs` が依存する `uuid` に moderate の脆弱性 advisory があるが、該当する
  API（`buf` 引数付きの生成）は使用していないため実害はない。

## 既知の未対応 / 将来拡張

`docs/仕様.md` の「14. 未決定・将来拡張」を参照（勤務区分、休憩時間、祝日カレンダー、
安定した社員識別子、メンバー別シートの Excel 出力 など）。
