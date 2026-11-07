import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 「名前の管理」（`/members`）にログイン Cookie なしで来たら、すぐ `/login` へ送る。
 *
 * ここでは Cookie の有無だけを見る（早めにリダイレクトするための近道）。
 * セッションが本当に有効かは、ページ・Server Action・Route Handler 側で
 * `isLoggedIn()`（[[auth]]）が DB と照合して判定する。
 */
const SESSION_COOKIE = "kintai_session"; // src/lib/auth.ts の SESSION_COOKIE と同じ値

export function proxy(request: NextRequest): NextResponse {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/members", "/members/:path*"],
};
