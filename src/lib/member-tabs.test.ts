import { describe, expect, it } from "vitest";

import { groupMembersByTeam, NO_TEAM_LABEL } from "./member-tabs";
import type { Member } from "./types";

let seq = 0;
const m = (name: string, team: string): Member => ({
  id: `id-${++seq}`,
  name,
  reading: "",
  team,
  sort_order: seq * 10,
  active: true,
  created_at: "",
  updated_at: "",
});

describe("groupMembersByTeam（勤怠入力のタブ分け）", () => {
  it("所属ごとにまとめ、タブは最初に出てきた順に並ぶ", () => {
    const tabs = groupMembersByTeam([
      m("矢代", "関西男性"),
      m("水木", "関西女性"),
      m("矢野", "関西男性"),
      m("比嘉", "アトム技研"),
    ]);
    expect(tabs.map((t) => t.label)).toEqual(["関西男性", "関西女性", "アトム技研"]);
    expect(tabs[0].members.map((x) => x.name)).toEqual(["矢代", "矢野"]);
  });

  it("所属が空の人は最後の「その他」タブにまとめる", () => {
    const tabs = groupMembersByTeam([m("未設定1", ""), m("矢代", "関西男性"), m("未設定2", "  ")]);
    expect(tabs.map((t) => t.label)).toEqual(["関西男性", NO_TEAM_LABEL]);
    expect(tabs[1].key).toBe("");
    expect(tabs[1].members.map((x) => x.name)).toEqual(["未設定1", "未設定2"]);
  });

  it("メンバーがいなければタブも無い", () => {
    expect(groupMembersByTeam([])).toEqual([]);
  });
});
