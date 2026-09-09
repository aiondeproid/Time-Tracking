"use client";

import { useActionState, useMemo, useState } from "react";

import type { RowView } from "@/lib/attendance-view";
import {
  dateTimeInputToIso,
  nowDateTimeInput,
  resolveWorkDate,
  weekdayJa,
} from "@/lib/time";

import {
  clockInAction,
  clockOutAction,
  type ActionState,
} from "@/lib/attendance-actions";

import { ClockOutFields } from "./clock-out-fields";

const INITIAL: ActionState = { ok: false, error: null };

type Mode = "idle" | "in" | "out";

export function ClockPanel({
  memberId,
  memberName,
  todayWorkDate,
  openRows,
}: {
  memberId: string;
  memberName: string;
  todayWorkDate: string;
  /** この人の「退勤待ち」記録（勤務日を問わない。出勤時刻の昇順）。 */
  openRows: RowView[];
}) {
  const [mode, setMode] = useState<Mode>("idle");
  // 開くたびに現在時刻でプリフィルし直すための key。
  const [formKey, setFormKey] = useState(0);

  const [inState, inAction, inPending] = useActionState(clockInAction, INITIAL);
  const [outState, outAction, outPending] = useActionState(
    clockOutAction,
    INITIAL,
  );

  // 保存成功時に idle へ戻す（成功状態ごとに 1 回だけ）。出勤・退勤は
  // それぞれ独立に判定する（1 セッションで両方成功しても取りこぼさない）。
  const [inHandled, setInHandled] = useState<ActionState | null>(null);
  const [outHandled, setOutHandled] = useState<ActionState | null>(null);
  if (inState.ok && inState !== inHandled) {
    setInHandled(inState);
    setMode("idle");
    setFormKey((k) => k + 1);
  }
  if (outState.ok && outState !== outHandled) {
    setOutHandled(outState);
    setMode("idle");
  }

  const canClockOut = openRows.length > 0;

  if (mode === "in") {
    return (
      <ClockInFields
        key={formKey}
        memberId={memberId}
        todayWorkDate={todayWorkDate}
        formAction={inAction}
        pending={inPending}
        error={inState.error}
        onCancel={() => setMode("idle")}
      />
    );
  }

  if (mode === "out") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-sky-600/30 bg-sky-50/50 p-4 dark:bg-sky-950/20">
        <p className="text-sm font-semibold">退勤の記録</p>
        {openRows.length === 1 && (
          <p className="text-xs text-zinc-500">
            {openRows[0].workDate}（{openRows[0].weekday}） {openRows[0].inClock}〜
            を退勤にします。
          </p>
        )}
        <ClockOutFields
          key={formKey}
          rows={openRows}
          action={outAction}
          pending={outPending}
          error={outState.error}
          onCancel={() => setMode("idle")}
          className="flex flex-col gap-2"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setFormKey((k) => k + 1);
            setMode("in");
          }}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          出勤
        </button>
        <button
          type="button"
          disabled={!canClockOut}
          onClick={() => {
            setFormKey((k) => k + 1);
            setMode("out");
          }}
          className="flex-1 rounded-lg bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          退勤
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {memberName} として記録します。
        {!canClockOut && "（退勤待ちの記録はありません）"}
      </p>
    </div>
  );
}

function ClockInFields({
  memberId,
  todayWorkDate,
  formAction,
  pending,
  error,
  onCancel,
}: {
  memberId: string;
  todayWorkDate: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const now = useMemo(() => nowDateTimeInput(), []);
  const [inDate, setInDate] = useState(now.date);
  const [inTime, setInTime] = useState(now.time);

  // 勤務日は出勤日時から自動で決まる（深夜 4:00 より前の出勤は前日扱い）。
  // 手動指定はできない。修正が必要なら勤怠一覧の編集画面で行う。
  const workDate = useMemo(() => {
    const iso = dateTimeInputToIso(inDate, inTime);
    return iso ? resolveWorkDate(iso) : todayWorkDate;
  }, [inDate, inTime, todayWorkDate]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-emerald-600/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20"
    >
      <p className="text-sm font-semibold">出勤の記録</p>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="workDate" value={workDate} />

      <fieldset className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          出勤日
          <input
            type="date"
            name="inDate"
            value={inDate}
            onChange={(e) => setInDate(e.target.value)}
            required
            className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          出勤時刻
          <input
            type="time"
            name="inTime"
            value={inTime}
            onChange={(e) => setInTime(e.target.value)}
            required
            className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
          />
        </label>
      </fieldset>

      <p className="text-xs text-zinc-500">
        勤務日は{" "}
        <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {workDate}（{weekdayJa(workDate)}）
        </span>{" "}
        として自動で記録されます（深夜 4:00 より前の出勤は前日扱い）。
      </p>

      <label className="flex flex-col gap-1 text-xs font-medium">
        備考（任意）
        <input
          type="text"
          name="note"
          maxLength={500}
          className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-900"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
