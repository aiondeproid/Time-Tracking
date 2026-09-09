# Supabase セットアップ

勤怠管理アプリのデータベース（`members` / `attendance`）と RLS ポリシーは
`supabase/migrations/` の SQL で管理する。

## マイグレーション

| ファイル | 内容 |
|---|---|
| `migrations/20260903000001_init.sql` | 初期スキーマ、インデックス、RLS ポリシー、`updated_at` トリガー |
| `seed.sql` | ローカル開発用の任意シード（本番では実行しない） |

## 適用手順

### 方法 A: Supabase ダッシュボードの SQL Editor（最短）

1. <https://supabase.com/dashboard> で新規プロジェクトを作成（無料枠 / リージョンは Tokyo 推奨）。
2. 左メニュー **SQL Editor** → **New query** に
   `migrations/20260903000001_init.sql` の内容を貼り付けて **Run**。
3. （任意）動作確認用に `seed.sql` も同様に実行。
4. **Project Settings → API** で以下を取得し、リポジトリ直下の `.env.local` に設定する
   （`.env.local.example` をコピーして埋める）。
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### 方法 B: Supabase CLI

```bash
# CLI（未インストールなら npx で実行可）
npx supabase login
npx supabase link --project-ref <your-project-ref>

# migrations/ をリモートに適用
npx supabase db push
```

### 方法 C: ローカル（Docker）

```bash
npx supabase init      # 未実行の場合。supabase/config.toml を生成
npx supabase start     # ローカルに Postgres + Studio + API が起動
npx supabase db reset  # migrations/ と seed.sql を再適用
```

`supabase start` の出力に含まれるローカルの API URL / anon key / service_role key を
`.env.local` に設定する。

## RLS の要点

- `attendance`: `anon` ロールに SELECT / INSERT / UPDATE / DELETE を許可（勤怠入力はログイン不要）。
- `members`: `anon` は SELECT のみ。追加・更新・アーカイブはサーバー側の Server Action /
  Route Handler が `SUPABASE_SERVICE_ROLE_KEY`（RLS バイパス）で実行する。
- アプリ全体の保護は Next.js の `proxy.ts`（サイト共通合言葉ゲート）が担う。
  「名前の管理」`/members` はさらに Supabase Auth のログイン必須（`proxy.ts` と各
  Server Action / Route Handler で検証）。

## Supabase Auth（「名前の管理」のログイン）

スキーマ変更・マイグレーションは不要。ダッシュボードで確認する項目:

- **Authentication → Sign In / Providers → Email**: 有効（既定）。
- **Authentication → Sign-ups → Allow new users to sign up**: 無効で可。ユーザー作成は
  サーバー側が `service_role`（`admin.createUser`、`email_confirm: true`）で行う。
  誰が登録できるかは招待コード `SIGNUP_CODE`（サーバー環境変数）で制御する。
- 確認メール・SMTP は不要。
