import type { MouseEvent } from "react";

/**
 * 出勤・退勤の日付／時刻入力の見た目。タブレットの指でも押しやすいよう大きくする。
 * カレンダー・時計のアイコンも大きくする（Chrome / Edge / Android 向けの疑似要素）。
 */
export const PICKER_INPUT_CLASS =
  "min-h-16 w-full rounded-lg border-2 border-black/20 bg-white px-4 py-3 text-2xl font-semibold tabular-nums dark:border-white/25 dark:bg-zinc-900 " +
  "focus:border-emerald-600 focus:outline-none " +
  "[&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer";

/** ラベル（「出勤時刻」など）の見た目。 */
export const PICKER_LABEL_CLASS = "flex flex-col gap-1.5 text-base font-semibold";

/**
 * 入力欄のどこを押しても選択画面（カレンダー・時刻）が開くようにする。
 * showPicker が使えないブラウザでは何もしない（そのまま通常の入力になる）。
 */
export function openPicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    /* 対応していない・ユーザー操作扱いにならない場合は無視 */
  }
}
