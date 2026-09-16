import { describe, it, expect } from "vitest";

import { searchMembers } from "./member-search";
import type { Member } from "./types";

function member(name: string, reading: string): Member {
  return {
    id: name,
    name,
    reading,
    sort_order: 0,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const members = [
  member("山田 太郎", "やまだ たろう"),
  member("佐藤 花子", "さとう はなこ"),
  member("鈴木 一郎", ""), // 読み仮名未登録
];

describe("searchMembers（勤怠入力の名前予測）", () => {
  it("クエリが空なら全員を返す", () => {
    expect(searchMembers(members, "")).toHaveLength(3);
  });

  it("名前の部分一致でヒットする", () => {
    expect(searchMembers(members, "山田").map((m) => m.name)).toEqual([
      "山田 太郎",
    ]);
  });

  it("読み仮名がひらがな入力にヒットする（漢字を打たなくてよい）", () => {
    expect(searchMembers(members, "やまだ").map((m) => m.name)).toEqual([
      "山田 太郎",
    ]);
  });

  it("読み仮名がカタカナ入力にもヒットする", () => {
    expect(searchMembers(members, "ヤマダ").map((m) => m.name)).toEqual([
      "山田 太郎",
    ]);
  });

  it("読み仮名がローマ字入力にもヒットする", () => {
    expect(searchMembers(members, "yamada").map((m) => m.name)).toEqual([
      "山田 太郎",
    ]);
    expect(searchMembers(members, "satou").map((m) => m.name)).toEqual([
      "佐藤 花子",
    ]);
  });

  it("読み仮名未登録のメンバーは、読み仮名側ではヒットしない（名前一致のみ）", () => {
    expect(searchMembers(members, "すずき")).toHaveLength(0);
    expect(searchMembers(members, "鈴木").map((m) => m.name)).toEqual([
      "鈴木 一郎",
    ]);
  });

  it("一致しなければ空配列", () => {
    expect(searchMembers(members, "存在しない名前")).toHaveLength(0);
  });
});
