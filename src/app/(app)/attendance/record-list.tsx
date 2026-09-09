"use client";

import { useActionState, useState } from "react";

import type { RowView } from "@/lib/attendance-view";
import { formatElapsed } from "@/lib/time";
import { useNow } from "@/lib/use-now";

import { clockOutAction, type ActionState } from "@/lib/attendance-actions";

import { ClockOutFields } from "./clock-out-fields";

const INITIAL: ActionState = { ok: false, error: null };

export function RecordList({ rows }: { rows: RowView[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-zinc-500 dark:border-white/20">
        まだ記録がありません。「出勤」から記録を追加してください。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <RecordItem row={row} />
        </li>
      ))}
    </ul>
  );
}

type Mode = "view" | "clockout";

function RecordItem({ row }: { row: RowView }) {
  const [mode, setMode] = useState<Mode>("view");

  const [outState, outAction, outPending] = useActionState(clockOutAction, INITIAL);

  // 退勤が成功したら表示モードへ戻す（成功状態ごとに 1 回だけ）。
  const [handled, setHandled] = useState<ActionState | null>(null);
  if (outState.ok && outState !== handled) {
    setHandled(outState);
    setMode("view");
  }

  return (
    <div className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium tabular-nums">
          {row.workDate}（{row.weekday}）
        </span>
        <span className="tabular-nums">
          {row.inClock}
          <span className="mx-1 text-zinc-400">〜</span>
          {row.isOpen ? (
            <span className="text-amber-600 dark:text-amber-500">退勤待ち</span>
          ) : (
            row.outClock
          )}
        </span>
        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
          実働 {row.isOpen ? <LiveWorked fromIso={row.inAtIso} /> : row.worked}
        </span>
        {row.note && (
          <span className="text-zinc-500" title={row.note}>
            📝 {row.note}
          </span>
        )}
      </div>

      {mode === "view" && row.isOpen && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("clockout")}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            退勤
          </button>
        </div>
      )}

      {mode === "clockout" && (
        <ClockOutFields
          rows={[row]}
          action={outAction}
          pending={outPending}
          error={outState.error}
          onCancel={() => setMode("view")}
        />
      )}
    </div>
  );
}

/** 退勤前の行に「出勤からの経過時間」を H:MM:SS でライブ表示する。 */
function LiveWorked({ fromIso }: { fromIso: string }) {
  const now = useNow();
  return <span suppressHydrationWarning>{formatElapsed(fromIso, now)}</span>;
}
