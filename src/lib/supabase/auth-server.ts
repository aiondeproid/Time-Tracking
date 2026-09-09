import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Cookie に紐づく Supabase Auth クライアント（anon キー）。
 *
 * Server Component / Server Action / Route Handler から使う。ログイン状態は
 * `@supabase/ssr` が Cookie で読み書きする。Server Component からはレスポンス
 * ヘッダーを書けないため Cookie 更新は失敗しうるが、その場合は proxy
 * （[[proxy]] の `updateSupabaseSession`）がセッションを更新するので無視してよい。
 */
export async function createAuthServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。.env.local を確認してください。",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component から呼ばれた場合は書き込み不可。proxy 側で更新する。
        }
      },
    },
  });
}
