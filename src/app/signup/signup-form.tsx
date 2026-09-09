"use client";

import { useActionState } from "react";

import { signupAction, type AuthState } from "@/lib/auth-actions";

const INITIAL: AuthState = { error: null };

const inputClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-900";

export function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signupAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        メールアドレス
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        パスワード
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500">8 文字以上</span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        登録用コード
        <input
          name="signupCode"
          type="password"
          autoComplete="off"
          required
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-500">
          管理者から共有された登録用コードを入力してください。
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "登録中…" : "登録してログイン"}
      </button>
    </form>
  );
}
