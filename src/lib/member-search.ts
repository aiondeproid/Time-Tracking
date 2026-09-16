import { toHiragana } from "wanakana";

import type { Member } from "./types";

/**
 * 全角/半角を揃え、カタカナ・ローマ字をひらがなに畳んで部分一致しやすくする。
 * 漢字はそのまま残る（wanakana は仮名/ローマ字以外に手を出さない）ので、
 * 漢字名は member.reading（登録済みの読み仮名）側でマッチさせる。
 */
export function foldForSearch(s: string): string {
  return toHiragana(s.normalize("NFKC"), { IMEMode: true }).toLowerCase();
}

/**
 * 入力文字列でメンバーを絞り込む。名前そのものだけでなく読み仮名にも
 * 一致すればヒットするので、漢字を入力しなくてもひらがな/カタカナ/ローマ字で
 * 名前を予測できる。
 */
export function searchMembers(members: Member[], query: string): Member[] {
  const q = foldForSearch(query.trim());
  if (!q) return members;
  return members.filter(
    (m) =>
      foldForSearch(m.name).includes(q) ||
      (m.reading !== "" && foldForSearch(m.reading).includes(q)),
  );
}
