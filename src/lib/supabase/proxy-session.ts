import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** proxy が扱う最小限のユーザー情報。 */
export type ProxyUser = { id: string; email: string | null };

/**
 * リクエストの Supabase セッションを検証・更新する。
 *
 * `@supabase/ssr` の推奨パターンに従い、`getUser()` を呼んでアクセストークンを
 * リフレッシュし、更新後の Cookie を載せた `NextResponse` を返す。呼び出し側は
 * この `response` をそのまま返すか、リダイレクトする場合は Cookie をコピーする。
 *
 * proxy は Node ランタイムで動く（Next.js 16）。
 */
export async function updateSupabaseSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: ProxyUser | null;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response, user: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user: user ? { id: user.id, email: user.email ?? null } : null,
  };
}
