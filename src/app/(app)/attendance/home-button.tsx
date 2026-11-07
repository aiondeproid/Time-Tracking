"use client";

import Link from "next/link";

import { Tr } from "@/components/tr";

const BUTTON_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:bg-zinc-900 dark:hover:bg-zinc-800";

/** 共用端末で次の人に前の人の名前が残らないよう、前回選んだメンバーの記憶を消す。 */
function forgetSelectedMember() {
  try {
    localStorage.removeItem("kintai.selectedMember");
  } catch {
    /* localStorage 不可でも移動はする */
  }
}

/** ホームに戻るボタン。名前を選んだ後に表示する。 */
export function HomeButton() {
  return (
    <Link href="/" onClick={forgetSelectedMember} className={BUTTON_CLASS}>
      <span aria-hidden="true">←</span>
      <Tr k="ホームに戻る" />
    </Link>
  );
}

/** 名前選択画面に戻るボタン。選択を解除して、名前ボタンの一覧（前回のタブ）を開く。 */
export function BackToPickerButton() {
  return (
    <Link href="/attendance" onClick={forgetSelectedMember} className={BUTTON_CLASS}>
      <span aria-hidden="true">←</span>
      <Tr k="名前選択に戻る" />
    </Link>
  );
}
