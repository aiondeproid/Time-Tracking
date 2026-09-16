import { toHiragana } from "wanakana";

/** 表記ゆれ（全角/半角・カタカナ）を吸収してひらがなに正規化する。 */
export function normalizeReading(s: string): string {
  return toHiragana(s.normalize("NFKC"));
}

/** ひらがな（長音符・中点・空白を含む）のみで構成されているか。空文字は許容。 */
export function isHiraganaReading(s: string): boolean {
  return s === "" || /^[ぁ-んー\s・]*$/.test(s);
}
