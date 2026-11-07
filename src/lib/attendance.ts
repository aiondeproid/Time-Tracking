import "server-only";

import { getDb } from "./db";
import type { Attendance, AttendanceWithMember, Member } from "./types";

type MemberRow = Omit<Member, "active"> & { active: number };

function toMember(row: MemberRow): Member {
  return { ...row, active: row.active === 1 };
}

const MEMBER_ORDER = "ORDER BY sort_order ASC, name ASC";

/** アクティブなメンバーを表示順で取得する（勤怠入力の名前選択用）。 */
export async function fetchActiveMembers(): Promise<Member[]> {
  const rows = getDb()
    .prepare(`SELECT * FROM members WHERE active = 1 ${MEMBER_ORDER}`)
    .all() as MemberRow[];
  return rows.map(toMember);
}

/** 全メンバーを表示順で取得する（一覧・Excel 用。アーカイブ済みも含む）。 */
export async function fetchAllMembers(): Promise<Member[]> {
  const rows = getDb()
    .prepare(`SELECT * FROM members ${MEMBER_ORDER}`)
    .all() as MemberRow[];
  return rows.map(toMember);
}

export async function fetchMemberById(id: string): Promise<Member | null> {
  const row = getDb()
    .prepare("SELECT * FROM members WHERE id = ?")
    .get(id) as MemberRow | undefined;
  return row ? toMember(row) : null;
}

/**
 * 勤怠入力画面に出す行: 指定メンバーの
 *   - 当該勤務日（workDate）の全記録
 *   - 退勤待ち（clock_out_at IS NULL）の全記録（勤務日を問わない）
 * を勤務日・出勤時刻順で返す。両条件に該当する行は 1 件だけ含まれる。
 */
export async function fetchInputRows(
  memberId: string,
  workDate: string,
): Promise<Attendance[]> {
  return getDb()
    .prepare(
      `SELECT * FROM attendance
        WHERE member_id = ?
          AND (work_date = ? OR clock_out_at IS NULL)
        ORDER BY work_date ASC, clock_in_at ASC`,
    )
    .all(memberId, workDate) as Attendance[];
}

type RangeRow = Attendance & {
  m_id: string;
  m_name: string;
  m_sort_order: number;
};

/**
 * 勤怠一覧・Excel 用。勤務日が [from, to] の範囲にある勤怠を、メンバー情報を
 * 結合して取得する。並び順は 勤務日 → メンバーの表示順 → 名前 → 出勤時刻。
 * memberId を渡すとそのメンバーに絞り込む（アーカイブ済みも表示対象）。
 */
export async function fetchAttendanceRange(params: {
  from: string;
  to: string;
  memberId?: string | null;
}): Promise<AttendanceWithMember[]> {
  const args: string[] = [params.from, params.to];
  let memberFilter = "";
  if (params.memberId) {
    memberFilter = "AND a.member_id = ?";
    args.push(params.memberId);
  }

  const rows = getDb()
    .prepare(
      `SELECT a.*, m.id AS m_id, m.name AS m_name, m.sort_order AS m_sort_order
         FROM attendance a
         JOIN members m ON m.id = a.member_id
        WHERE a.work_date >= ? AND a.work_date <= ? ${memberFilter}
        ORDER BY a.work_date ASC, m.sort_order ASC, m.name ASC, a.clock_in_at ASC`,
    )
    .all(...args) as RangeRow[];

  return rows.map(({ m_id, m_name, m_sort_order, ...a }) => ({
    ...a,
    member: { id: m_id, name: m_name, sort_order: m_sort_order },
  }));
}

export async function fetchAttendanceById(id: string): Promise<Attendance | null> {
  const row = getDb()
    .prepare("SELECT * FROM attendance WHERE id = ?")
    .get(id) as Attendance | undefined;
  return row ?? null;
}
