import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { isLoggedIn } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { isSignupEnabled } from "@/lib/signup-code";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "名前の管理 | 勤怠管理" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const safeNext =
    safeNextPath(typeof next === "string" ? next : undefined) ?? "/members";

  if (await isLoggedIn()) redirect(safeNext);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-bold tracking-tight">名前の管理</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          開くには管理用コードを入力してください。
        </p>

        {isSignupEnabled() ? (
          <LoginForm next={safeNext} />
        ) : (
          <p
            role="alert"
            className="text-sm leading-relaxed text-red-600 dark:text-red-400"
          >
            サーバー側で <code className="font-mono">SIGNUP_CODE</code>{" "}
            が設定されていないため、名前の管理は開けません。<code className="font-mono">.env.local</code>{" "}
            を確認してください。
          </p>
        )}

        <p className="mt-6 text-sm">
          <a href="/attendance" className="underline underline-offset-2">
            勤怠入力に戻る
          </a>
        </p>
      </div>
    </main>
  );
}
