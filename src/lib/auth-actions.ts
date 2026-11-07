"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticate, createUser, endSession, startSession } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db";
import { safeNextPath } from "@/lib/safe-next";
import { isSignupEnabled, isValidSignupCode } from "@/lib/signup-code";

export type AuthState = { error: string | null };

const fail = (error: string): AuthState => ({ error });

const loginIdField = z
  .string()
  .trim()
  .min(3, "ログイン ID は 3 文字以上にしてください")
  .max(32, "ログイン ID は 32 文字以内にしてください")
  .regex(/^[A-Za-z0-9._-]+$/, "ログイン ID は半角英数字と . _ - で入力してください");

const credentials = z.object({
  loginId: loginIdField,
  password: z.string().min(8, "パスワードは 8 文字以上にしてください"),
});

const signupInput = credentials.extend({
  signupCode: z.string().min(1, "登録用コードを入力してください"),
});

function destination(formData: FormData): string {
  return safeNextPath(formData.get("next")) ?? "/members";
}

/** ログイン ID とパスワードでログインし、セッション Cookie を発行する。 */
export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail("ログイン ID またはパスワードが違います。");

  const userId = await authenticate(parsed.data.loginId, parsed.data.password);
  if (!userId) return fail("ログイン ID またはパスワードが違います。");

  await startSession(userId);
  redirect(destination(formData));
}

/** 登録用コードを検証し、アカウントを作成してそのままログインさせる。 */
export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSignupEnabled()) {
    return fail("サーバー側で SIGNUP_CODE が設定されていません。");
  }

  const parsed = signupInput.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
    signupCode: formData.get("signupCode"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (!isValidSignupCode(parsed.data.signupCode)) {
    return fail("登録用コードが違います。");
  }

  let userId: string | null;
  try {
    userId = await createUser(parsed.data.loginId, parsed.data.password);
  } catch (e) {
    if (isUniqueViolation(e)) userId = null;
    else return fail("アカウントの作成に失敗しました。");
  }
  if (!userId) return fail("このログイン ID は使用済みです。別の ID にしてください。");

  await startSession(userId);
  redirect(destination(formData));
}

/** ログアウトしてログイン画面へ戻る（フォームの action 用なので戻り値なし）。 */
export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
