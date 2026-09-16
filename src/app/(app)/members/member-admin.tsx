"use client";

import { useActionState, useState } from "react";

import { logoutAction } from "@/lib/auth-actions";
import type { Member } from "@/lib/types";

import {
  addMemberAction,
  moveMemberAction,
  renameMemberAction,
  setMemberActiveAction,
  setSortOrderAction,
  type ActionState,
} from "./actions";
import { ImportPanel } from "./import-panel";

const INITIAL: ActionState = { ok: false, error: null };

export function MemberAdmin({
  members,
  userEmail,
}: {
  members: Member[];
  userEmail: string | null;
}) {
  const [addState, addAction, addPending] = useActionState(
    addMemberAction,
    INITIAL,
  );
  const activeCount = members.filter((m) => m.active).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <span>
          {userEmail ?? "ログイン中"} でログイン中（{activeCount} 名がアクティブ）。
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded border border-amber-400 px-2 py-1 font-medium hover:bg-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50"
          >
            ログアウト
          </button>
        </form>
      </div>

      {/* 追加 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          メンバーを追加
        </h2>
        <form action={addAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            名前
            <input
              name="name"
              required
              maxLength={100}
              className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            読み仮名（ひらがな・任意）
            <input
              name="reading"
              maxLength={100}
              placeholder="やまだ たろう"
              className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            表示順
            <input
              name="sortOrder"
              type="number"
              defaultValue={activeCount * 10 + 10}
              className="w-24 rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            disabled={addPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {addPending ? "追加中…" : "追加"}
          </button>
        </form>
        {addState.error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {addState.error}
          </p>
        )}
      </section>

      {/* 一覧 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          メンバー一覧（{members.length} 名）
        </h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/20">
            まだメンバーがいません。上のフォームか、下のファイル取り込みで追加してください。
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {members.map((m, i) => (
              <li key={m.id}>
                <MemberRow
                  member={m}
                  isFirst={i === 0}
                  isLast={i === members.length - 1}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ImportPanel />
    </div>
  );
}

function MemberRow({
  member,
  isFirst,
  isLast,
}: {
  member: Member;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const [renameState, renameAction, renamePending] = useActionState(
    renameMemberAction,
    INITIAL,
  );
  const [sortState, sortAction, sortPending] = useActionState(
    setSortOrderAction,
    INITIAL,
  );
  const [moveState, moveAction, movePending] = useActionState(
    moveMemberAction,
    INITIAL,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setMemberActiveAction,
    INITIAL,
  );

  const [handled, setHandled] = useState<ActionState | null>(null);
  if (renameState.ok && renameState !== handled) {
    setHandled(renameState);
    setEditing(false);
  }

  const err =
    renameState.error ||
    sortState.error ||
    moveState.error ||
    activeState.error ||
    null;

  return (
    <div className="flex flex-col gap-1 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 並び替え */}
        <div className="flex flex-col">
          <form action={moveAction}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst || movePending}
              aria-label="上へ"
              className="px-1 leading-none text-zinc-500 disabled:opacity-30"
            >
              ▲
            </button>
          </form>
          <form action={moveAction}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast || movePending}
              aria-label="下へ"
              className="px-1 leading-none text-zinc-500 disabled:opacity-30"
            >
              ▼
            </button>
          </form>
        </div>

        {/* 名前 */}
        {editing ? (
          <form action={renameAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={member.id} />
            <input
              name="name"
              defaultValue={member.name}
              required
              maxLength={100}
              autoFocus
              className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-900"
            />
            <input
              name="reading"
              defaultValue={member.reading}
              maxLength={100}
              placeholder="読み仮名（ひらがな）"
              className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={renamePending}
              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/20"
            >
              取消
            </button>
          </form>
        ) : (
          <span className="min-w-[8rem] font-medium">
            {member.name}
            {member.reading && (
              <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">
                （{member.reading}）
              </span>
            )}
            {!member.active && (
              <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                アーカイブ
              </span>
            )}
          </span>
        )}

        {/* 表示順 */}
        <form action={sortAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={member.id} />
          <label className="text-xs text-zinc-500">表示順</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={member.sort_order}
            className="w-20 rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={sortPending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-60 dark:border-white/20"
          >
            保存
          </button>
        </form>

        <div className="ml-auto flex gap-1.5">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/20"
            >
              名前を編集
            </button>
          )}
          <form action={activeAction}>
            <input type="hidden" name="id" value={member.id} />
            <input
              type="hidden"
              name="active"
              value={member.active ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={activePending}
              className={
                member.active
                  ? "rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  : "rounded-md border border-emerald-400 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              }
            >
              {member.active ? "アーカイブ" : "復帰"}
            </button>
          </form>
        </div>
      </div>

      {err && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {err}
        </p>
      )}
    </div>
  );
}
