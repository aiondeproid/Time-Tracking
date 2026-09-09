"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNextPath } from "@/lib/gate";
import { isSignupEnabled, isValidSignupCode } from "@/lib/signup-code";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

const fail = (error: string): AuthState => ({ error });

const credentials = z.object({
  email: z.email("メールアドレスの形式が正しくありません").trim(),
  password: z.string().min(8, "パスワードは 8 文字以上にしてください"),
});

const signupInput = credentials.extend({
  signupCode: z.string().min(1, "登録用コードを入力してください"),
});

function destination(formData: FormData): string {
  return safeNextPath(formData.get("next")) ?? "/members";
}

/** メールアドレスとパスワードでログインし、セッション Cookie を発行する。 */
export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("メールアドレスまたはパスワードが違います。");

  redirect(destination(formData));
}

/**
 * 登録用コードを検証し、アカウントを作成してそのままログインさせる。
 *
 * ユーザー作成は service_role（`admin.createUser`）で行い、`email_confirm: true`
 * で確認メールを省く。Supabase 側の公開サインアップは無効のままでよい。
 */
export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSignupEnabled()) {
    return fail("サーバー側で SIGNUP_CODE が設定されていません。");
  }

  const parsed = signupInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    signupCode: formData.get("signupCode"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (!isValidSignupCode(parsed.data.signupCode)) {
    return fail("登録用コードが違います。");
  }

  const admin = createServiceRoleClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError) {
    const already = /already|registered|exists|duplicate/i.test(
      createError.message,
    );
    return fail(
      already
        ? "このメールアドレスは登録済みです。ログインしてください。"
        : "アカウントの作成に失敗しました。",
    );
  }

  const supabase = await createAuthServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // 作成は成功しているので、ログインだけ失敗した場合はログイン画面へ誘導する。
  if (signInError) {
    redirect(`/login?next=${encodeURIComponent(destination(formData))}`);
  }

  redirect(destination(formData));
}

/** ログアウトしてログイン画面へ戻る（フォームの action 用なので戻り値なし）。 */
export async function logoutAction(): Promise<void> {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
