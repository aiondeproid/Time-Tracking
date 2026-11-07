"use client";

import { useMemo } from "react";

import type { RowView } from "@/lib/attendance-view";
import { nowDateTimeInput } from "@/lib/time";
import { Tr } from "@/components/tr";

import { openPicker, PICKER_INPUT_CLASS, PICKER_LABEL_CLASS } from "./picker-input";

/**
 * 退勤時刻を入力するフォーム。現在時刻をプリフィルする。
 * rows が 2 件以上なら、どの「退勤待ち」記録を確定するか選ばせる。
 */
export function ClockOutFields({
  rows,
  action,
  pending,
  error,
  onCancel,
  className = "mt-3 flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/15",
}: {
  rows: RowView[];
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  className?: string;
}) {
  const now = useMemo(() => nowDateTimeInput(), []);
  const multiple = rows.length > 1;

  return (
    <form action={action} className={className}>
      {multiple ? (
        <label className="flex flex-col gap-1 text-xs font-medium">
          <Tr k="退勤する記録" layout="inline" />
          <select
            name="id"
            defaultValue={rows[rows.length - 1].id}
            className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.workDate}（{r.weekday}） {r.inClock}〜
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="id" value={rows[0].id} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={PICKER_LABEL_CLASS}>
          <Tr k="退勤日" layout="inline" />
          <input
            type="date"
            name="outDate"
            defaultValue={now.date}
            required
            onClick={openPicker}
            className={PICKER_INPUT_CLASS}
          />
        </label>
        <label className={PICKER_LABEL_CLASS}>
          <Tr k="退勤時刻" layout="inline" />
          <input
            type="time"
            name="outTime"
            defaultValue={now.time}
            required
            onClick={openPicker}
            className={PICKER_INPUT_CLASS}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? <Tr k="保存中…" /> : <Tr k="退勤を保存" />}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
        >
          <Tr k="キャンセル" />
        </button>
      </div>
    </form>
  );
}
