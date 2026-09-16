"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { searchMembers } from "@/lib/member-search";
import type { Member } from "@/lib/types";

const STORAGE_KEY = "kintai.selectedMember";
const MAX_SUGGESTIONS = 8;

export function MemberSelect({
  members,
  selectedId,
  selectedName,
}: {
  members: Member[];
  selectedId: string | null;
  /** 選択中メンバーの表示名（アーカイブ済みでも渡ってくる場合がある）。 */
  selectedName: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // open = 入力（絞り込み）モード。query = 入力中の文字列。
  // 未編集時は selectedName をそのまま見せる。
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputValue = open ? query : (selectedName ?? "");

  const matches = useMemo(
    () => searchMembers(members, query).slice(0, MAX_SUGGESTIONS),
    [members, query],
  );

  // activeIndex を候補数に収める。
  const active =
    matches.length === 0 ? -1 : Math.min(activeIndex, matches.length - 1);

  // 未選択なら、前回選んだメンバーを復元する（存在する場合のみ）。
  useEffect(() => {
    if (selectedId) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && members.some((m) => m.id === stored)) {
      router.replace(`/attendance?member=${encodeURIComponent(stored)}`);
    }
  }, [selectedId, members, router]);

  function startEditing() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function stopEditing() {
    setOpen(false);
    setQuery("");
  }

  function commit(member: Member | null) {
    stopEditing();
    try {
      if (member) localStorage.setItem(STORAGE_KEY, member.id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage 不可でも動作は継続 */
    }
    router.push(
      member
        ? `/attendance?member=${encodeURIComponent(member.id)}`
        : "/attendance",
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 変換確定の Enter などを拾わない。
    if (e.nativeEvent.isComposing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && active >= 0) {
        e.preventDefault();
        commit(matches[active]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      stopEditing();
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        名前
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? `${listboxId}-opt-${active}` : undefined
          }
          autoComplete="off"
          placeholder={
            selectedName ? `現在: ${selectedName}（入力で変更）` : "名前を入力"
          }
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={startEditing}
          onBlur={(e) => {
            // リスト内のクリックでは閉じない（commit 側で閉じる）。
            if (rootRef.current?.contains(e.relatedTarget as Node)) return;
            stopEditing();
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 pr-9 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-900"
        />

        {selectedName && !open && (
          <button
            type="button"
            aria-label="選択を解除"
            onClick={() => commit(null)}
            className="absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-md border border-black/15 bg-white py-1 shadow-lg dark:border-white/20 dark:bg-zinc-900"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">
              一致する名前がありません
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={m.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  // input の blur より前に選択を確定する。
                  e.preventDefault();
                  commit(m);
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === active
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {m.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
