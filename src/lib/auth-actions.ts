"use server";

import { redirect } from "next/navigation";

import {
  clientKey,
  endSession,
  loginLockedFor,
  recordLoginFailure,
  recordLoginSuccess,
  startSession,
} from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { isSignupEnabled, isValidSignupCode } from "@/lib/signup-code";

export type AuthState = { error: string | null };

const fail = (error: string): AuthState => ({ error });

function lockMessage(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return `間違いが続いたため、ロックしています。約 ${min} 分後にもう一度お試しください。`;
}

/** 管理用コード（SIGNUP_CODE）を照合し、正しければセッション Cookie を発行する。 */
export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSignupEnabled()) {
    return fail("サーバー側で SIGNUP_CODE が設定されていません。");
  }

  const key = await clientKey();
  const locked = loginLockedFor(key);
  if (locked > 0) return fail(lockMessage(locked));

  const code = formData.get("code");
  if (typeof code !== "string" || !isValidSignupCode(code)) {
    recordLoginFailure(key);
    const nowLocked = loginLockedFor(key);
    return fail(nowLocked > 0 ? lockMessage(nowLocked) : "コードが違います。");
  }

  recordLoginSuccess(key);
  await startSession();
  redirect(safeNextPath(formData.get("next")) ?? "/members");
}

/** ログアウトしてログイン画面へ戻る（フォームの action 用なので戻り値なし）。 */
export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
