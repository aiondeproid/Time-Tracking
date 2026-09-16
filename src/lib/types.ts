/**
 * DB 行の型。`supabase/migrations/20260903000001_init.sql` のスキーマに対応。
 * 時刻カラムは timestamptz を ISO 文字列として受け取る。
 */

export type Member = {
  id: string;
  name: string;
  /** 読み仮名（ひらがな）。勤怠入力の名前検索の補助用。未設定なら空文字。 */
  reading: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  member_id: string;
  /** 勤務日（`YYYY-MM-DD`）。 */
  work_date: string;
  /** 出勤日時（ISO 文字列 / UTC）。 */
  clock_in_at: string;
  /** 退勤日時（ISO 文字列 / UTC）。null = 退勤待ち。 */
  clock_out_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** members へ挿入するときのペイロード（サーバー経由のみ）。 */
export type MemberInsert = {
  name: string;
  reading?: string;
  sort_order?: number;
  active?: boolean;
};

/** members を更新するときのペイロード（サーバー経由のみ）。 */
export type MemberUpdate = Partial<
  Pick<Member, "name" | "reading" | "sort_order" | "active">
>;

/** attendance へ挿入するときのペイロード。 */
export type AttendanceInsert = {
  member_id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at?: string | null;
  note?: string | null;
};

/** attendance を更新するときのペイロード。 */
export type AttendanceUpdate = Partial<
  Pick<Attendance, "work_date" | "clock_in_at" | "clock_out_at" | "note">
>;

/** 勤怠一覧・Excel 用に members を結合した行。 */
export type AttendanceWithMember = Attendance & {
  member: Pick<Member, "id" | "name" | "sort_order">;
};
