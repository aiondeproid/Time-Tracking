import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { GATE_COOKIE, verifyGateToken } from "@/lib/gate";
import { updateSupabaseSession } from "@/lib/supabase/proxy-session";

/**
 * リクエストの前段で走る 2 段構えの関門（仕様書「8. 認証・セキュリティ」）。
 *
 * 1. サイト共通合言葉ゲート: 有効なセッション Cookie が無ければ `/gate` へ。
 * 2. ログイン（「名前の管理」だけ）: `/members` は Supabase Auth のログイン必須。
 *    未ログインなら `/login` へ。ログイン済みで `/login`・`/signup` に来たら
 *    `/members` へ。`/attendance`・`/list` などは 1. のみで通す。
 *
 * Proxy は Next.js 16 では Node ランタイムで動作する。
 */
const AUTH_PATHS = new Set(["/login", "/signup"]);

function isMembersPath(pathname: string): boolean {
  return pathname === "/members" || pathname.startsWith("/members/");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/gate") {
    return NextResponse.next();
  }

  // --- 1. サイト共通合言葉ゲート ---
  if (!verifyGateToken(request.cookies.get(GATE_COOKIE)?.value)) {
    const url = request.nextUrl.clone();
    url.pathname = "/gate";
    url.search = "";
    const dest = `${pathname}${search}`;
    if (dest && dest !== "/") {
      url.searchParams.set("next", dest);
    }
    return NextResponse.redirect(url);
  }

  // --- 2. ログイン（「名前の管理」と認証ページのみ Supabase セッションを更新）---
  if (isMembersPath(pathname) || AUTH_PATHS.has(pathname)) {
    const { response, user } = await updateSupabaseSession(request);

    if (isMembersPath(pathname) && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      return withCookies(NextResponse.redirect(url), response);
    }

    if (AUTH_PATHS.has(pathname) && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/members";
      url.search = "";
      return withCookies(NextResponse.redirect(url), response);
    }

    return response;
  }

  return NextResponse.next();
}

/** `from` が付けた（更新済みの）セッション Cookie をリダイレクト応答へ引き継ぐ。 */
function withCookies(to: NextResponse, from: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスに適用:
     * - _next/static, _next/image（ビルド成果物・画像最適化）
     * - favicon.ico
     * - public/ 配下の静的アセット（拡張子で判定）
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)",
  ],
};
