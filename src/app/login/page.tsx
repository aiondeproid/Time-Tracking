import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/gate";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン | 勤怠管理" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const safeNext =
    safeNextPath(typeof next === "string" ? next : undefined) ?? "/members";

  if (await getSessionUser()) redirect(safeNext);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-bold tracking-tight">ログイン</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          「名前の管理」を開くにはログインが必要です。
        </p>

        <LoginForm next={safeNext} />

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          アカウントが無い場合は{" "}
          <a
            href={`/signup?next=${encodeURIComponent(safeNext)}`}
            className="font-medium underline underline-offset-2"
          >
            新規登録
          </a>
        </p>
      </div>
    </main>
  );
}
