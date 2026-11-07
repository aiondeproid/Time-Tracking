import type { Member } from "./types";

/** 所属が空のメンバーを入れるタブの名前。 */
export const NO_TEAM_LABEL = "その他";

export type MemberTab = {
  /** タブの識別子（= 所属。所属なしは空文字）。 */
  key: string;
  /** 表示名。 */
  label: string;
  members: Member[];
};

/**
 * メンバーを所属ごとのタブに分ける（勤怠入力の名前ボタン用）。
 *
 * - タブの並び: 表示順で最初に出てくるメンバーの順（= 名前の管理の表示順に従う）。
 * - タブ内の並び: 渡された順のまま（呼び出し側で表示順に並べておくこと）。
 * - 所属が空のメンバーは最後の「その他」タブにまとめる。
 */
export function groupMembersByTeam(members: Member[]): MemberTab[] {
  const tabs = new Map<string, MemberTab>();
  for (const m of members) {
    const key = m.team.trim();
    let tab = tabs.get(key);
    if (!tab) {
      tab = { key, label: key || NO_TEAM_LABEL, members: [] };
      tabs.set(key, tab);
    }
    tab.members.push(m);
  }
  const list = [...tabs.values()];
  const noTeam = list.findIndex((t) => t.key === "");
  if (noTeam >= 0) list.push(...list.splice(noTeam, 1));
  return list;
}
