import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/gate";
import { isSignupEnabled } from "@/lib/signup-code";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "新規登録 | 勤怠管理" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const { next } = await props.searchParams;
  const safeNext =
    safeNextPath(typeof next === "string" ? next : undefined) ?? "/members";

  if (await getSessionUser()) redirect(safeNext);

  const enabled = isSignupEnabled();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-bold tracking-tight">新規登録</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          「名前の管理」を使う担当者のアカウントを作成します。
        </p>

        {enabled ? (
          <SignupForm next={safeNext} />
        ) : (
          <p
            role="alert"
            className="text-sm leading-relaxed text-red-600 dark:text-red-400"
          >
            サーバー側で <code className="font-mono">SIGNUP_CODE</code>{" "}
            が設定されていないため、新規登録は無効です。環境変数を確認してください。
          </p>
        )}

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          すでにアカウントがある場合は{" "}
          <a
            href={`/login?next=${encodeURIComponent(safeNext)}`}
            className="font-medium underline underline-offset-2"
          >
            ログイン
          </a>
        </p>
      </div>
    </main>
  );
}
