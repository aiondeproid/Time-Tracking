"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import { searchMembers } from "@/lib/member-search";
import { groupMembersByTeam, teamCategory, type TeamCategory } from "@/lib/member-tabs";
import type { Member } from "@/lib/types";
import { Tr } from "@/components/tr";

/** 所属区分ごとの色（タブ・所属バッジ）。Tailwind が拾えるようクラス名は省略せずに書く。 */
const TEAM_COLORS: Record<TeamCategory, { tab: string; active: string; badge: string }> = {
  male: {
    tab: "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50",
    active: "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  },
  female: {
    tab: "border-pink-300 bg-pink-50 text-pink-800 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-200 dark:hover:bg-pink-900/50",
    active: "border-pink-600 bg-pink-600 text-white dark:border-pink-500 dark:bg-pink-500",
    badge: "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-200",
  },
  agency: {
    tab: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50",
    active: "border-amber-600 bg-amber-600 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-zinc-900",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
  },
  support: {
    tab: "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50",
    active: "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  },
  none: {
    tab: "border-black/15 bg-white text-zinc-700 hover:bg-black/5 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10",
    active: "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
  },
};

const MEMBER_KEY = "kintai.selectedMember";
const TAB_KEY = "kintai.selectedTab";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 他のブラウザタブでの localStorage 変更を購読する（useSyncExternalStore 用）。 */
function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* localStorage 不可でも動作は継続 */
  }
}

/**
 * 勤怠入力の名前選択。検索欄 → 所属タブ → 名前ボタン。
 *
 * - 検索欄に入力すると、タブに関係なく全員から絞り込む（読み仮名・カタカナ・ローマ字でも可）。
 * - 名前を選ぶと 1 行にたたみ、「名前を変更」で再び開く。
 */
export function MemberPicker({
  members,
  selectedId,
  selectedName,
}: {
  /** アクティブなメンバー（表示順）。 */
  members: Member[];
  selectedId: string | null;
  /** 選択中メンバーの表示名（アーカイブ済みでも渡ってくる場合がある）。 */
  selectedName: string | null;
}) {
  const router = useRouter();
  const searchId = useId();
  const panelId = useId();

  const tabs = useMemo(() => groupMembersByTeam(members), [members]);
  const selectedTeam = members.find((m) => m.id === selectedId)?.team.trim();

  const [open, setOpen] = useState(selectedId === null);
  const [query, setQuery] = useState("");
  // 開くタブ: この画面で選んだタブ（選択中メンバーの所属で初期化）→ 前回開いたタブ → 先頭。
  const [tabKey, setTabKey] = useState<string | null>(selectedTeam ?? null);
  // 前回開いたタブ（サーバー描画時は null。ハイドレーション後に localStorage の値になる）。
  const storedTab = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(TAB_KEY),
    () => null,
  );

  // 選択が変わったら（別の人を選んだ・解除した）開閉を合わせる。
  const [prevSelected, setPrevSelected] = useState(selectedId);
  if (prevSelected !== selectedId) {
    setPrevSelected(selectedId);
    setOpen(selectedId === null);
    setQuery("");
    if (selectedTeam !== undefined) setTabKey(selectedTeam);
  }

  // 未選択なら、前回選んだメンバーを復元する（存在する場合のみ）。
  useEffect(() => {
    if (selectedId) return;
    const stored = readStorage(MEMBER_KEY);
    if (stored && members.some((m) => m.id === stored)) {
      router.replace(`/attendance?member=${encodeURIComponent(stored)}`);
    }
  }, [selectedId, members, router]);

  const currentTab =
    tabs.find((t) => t.key === tabKey) ?? tabs.find((t) => t.key === storedTab) ?? tabs[0];
  const searching = query.trim() !== "";
  const results = useMemo(
    () => (searching ? searchMembers(members, query) : []),
    [members, query, searching],
  );
  const shown = searching ? results : (currentTab?.members ?? []);

  function choose(member: Member | null) {
    writeStorage(MEMBER_KEY, member?.id ?? null);
    if (member) writeStorage(TAB_KEY, member.team.trim());
    setQuery("");
    setOpen(member === null);
    router.push(member ? `/attendance?member=${encodeURIComponent(member.id)}` : "/attendance");
  }

  function selectTab(key: string) {
    setTabKey(key);
    writeStorage(TAB_KEY, key);
  }

  // --- 選択済みでたたんでいる状態 ---
  if (selectedName && !open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-600/30 bg-emerald-50/60 px-4 py-3 dark:bg-emerald-950/20">
        <span className="text-sm text-zinc-600 dark:text-zinc-400"><Tr k="選択中" /></span>
        <span className="text-lg font-bold">{selectedName}</span>
        {selectedTeam && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TEAM_COLORS[teamCategory(selectedTeam)].badge}`}>
            {selectedTeam}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-controls={panelId}
            className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <Tr k="名前を変更" />
          </button>
          <button
            type="button"
            onClick={() => choose(null)}
            className="rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Tr k="選択を解除" />
          </button>
        </div>
      </div>
    );
  }

  // --- 名前を選ぶパネル ---
  return (
    <section id={panelId} className="flex flex-col gap-3" aria-label="名前を選ぶ">
      <div className="flex items-end gap-2">
        <label htmlFor={searchId} className="flex flex-1 flex-col gap-1 text-sm font-medium">
          <Tr k="名前を検索" layout="inline" />
          <div className="relative">
            <input
              id={searchId}
              type="search"
              autoComplete="off"
              enterKeyHint="go"
              placeholder="漢字・ひらがな・カタカナ・ローマ字（例: やまだ / yamada）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && searching && results.length > 0) {
                  e.preventDefault();
                  choose(results[0]);
                } else if (e.key === "Escape") {
                  setQuery("");
                }
              }}
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-base font-normal outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-900"
            />
          </div>
        </label>
        {selectedName && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            <Tr k="閉じる" />
          </button>
        )}
      </div>

      {!searching && tabs.length > 1 && (
        <div role="tablist" aria-label="所属" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const active = t.key === currentTab?.key;
            const color = TEAM_COLORS[teamCategory(t.key)];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? `${color.active} shadow-sm` : color.tab
                }`}
              >
                {t.label}
                <span className={active ? "ml-1 opacity-80" : "ml-1 opacity-60"}>{t.members.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {searching && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          「{query.trim()}」の検索結果: {results.length} 名
          {results.length > 0 && <span className="ml-2 text-xs text-zinc-500">Enter で先頭の人を選択</span>}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/20">
          {searching ? "一致する名前がありません" : "このタブにはメンバーがいません"}
        </p>
      ) : (
        <ul
          role={searching ? "list" : "tabpanel"}
          aria-label={searching ? "検索結果" : currentTab?.label}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
        >
          {shown.map((m) => {
            const isSelected = m.id === selectedId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => choose(m)}
                  aria-pressed={isSelected}
                  className={`flex min-h-12 w-full flex-col items-center justify-center rounded-lg border px-2 py-2 text-base font-medium transition-colors ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-black/15 bg-white hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/20 dark:bg-zinc-900 dark:hover:bg-emerald-950/30"
                  }`}
                >
                  <span className="leading-tight">{m.name}</span>
                  {searching && m.team && (
                    <span className={`mt-0.5 rounded px-1.5 text-xs font-normal ${isSelected ? "text-white/80" : TEAM_COLORS[teamCategory(m.team)].badge}`}>
                      {m.team}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
