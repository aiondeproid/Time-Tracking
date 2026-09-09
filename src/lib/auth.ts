import "server-only";

import { redirect } from "next/navigation";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

export type SessionUser = { id: string; email: string | null };

/**
 * ログイン中のユーザーを返す。未ログインなら null。
 *
 * `getUser()` は Supabase の認証サーバーでトークンを検証するため、`getSession()`
 * より安全。「名前の管理」の Server Component / Server Action / Route Handler は
 * これで境界を守る（サイト共通合言葉ゲート [[gate]] の内側の追加の関門）。
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** ログイン必須。未ログインなら `/login` へリダイレクトする。 */
export async function requireUser(nextPath = "/members"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
