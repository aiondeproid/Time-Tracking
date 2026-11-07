"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isLoggedIn } from "@/lib/auth";
import {
  insertMember,
  moveMember,
  setMemberActive,
  updateMemberName,
  updateMemberSortOrder,
} from "@/lib/members";
import { isHiraganaReading, normalizeReading } from "@/lib/reading";

export type ActionState = { ok: boolean; error: string | null };

const OK: ActionState = { ok: true, error: null };
const fail = (error: string): ActionState => ({ ok: false, error });

/** ログイン済みか（「名前の管理」はログイン必須）。 */
async function requireUser(): Promise<boolean> {
  return isLoggedIn();
}

function revalidateAll() {
  revalidatePath("/members");
  revalidatePath("/attendance");
  revalidatePath("/list");
}

const nameField = z
  .string()
  .trim()
  .min(1, "名前を入力してください")
  .max(100, "名前は 100 文字以内で入力してください");
/**
 * 読み仮名（任意）。カタカナ/全角英数で入力されてもひらがなに正規化して保存する。
 * 検索側（member-search）はこの正規化を前提に照合する。
 */
const readingField = z
  .string()
  .trim()
  .max(100, "読み仮名は 100 文字以内で入力してください")
  .transform((s) => normalizeReading(s))
  .refine(
    isHiraganaReading,
    "読み仮名はひらがな（またはカタカナ）で入力してください",
  );
/** 所属（勤怠入力のタブ名・任意）。空なら「その他」タブに出る。 */
const teamField = z
  .string()
  .trim()
  .max(50, "所属は 50 文字以内で入力してください");
const sortOrderField = z.coerce
  .number()
  .refine((n) => Number.isFinite(n), "表示順は数値で入力してください")
  .transform((n) => Math.trunc(n));

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireUser())) return fail("ログインが必要です。");
  const parsed = z
    .object({
      name: nameField,
      reading: readingField,
      team: teamField,
      sortOrder: sortOrderField,
    })
    .safeParse({
      name: formData.get("name"),
      reading: formData.get("reading") || "",
      team: formData.get("team") || "",
      sortOrder: formData.get("sortOrder") || 0,
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    const { name, reading, team, sortOrder } = parsed.data;
    await insertMember(name, reading, team, sortOrder);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "追加に失敗しました");
  }
  revalidateAll();
  return OK;
}

export async function renameMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireUser())) return fail("ログインが必要です。");
  const parsed = z
    .object({ id: z.uuid(), name: nameField, reading: readingField, team: teamField })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      reading: formData.get("reading") || "",
      team: formData.get("team") || "",
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    const { id, name, reading, team } = parsed.data;
    await updateMemberName(id, name, reading, team);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新に失敗しました");
  }
  revalidateAll();
  return OK;
}

export async function setSortOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireUser())) return fail("ログインが必要です。");
  const parsed = z
    .object({ id: z.uuid(), sortOrder: sortOrderField })
    .safeParse({ id: formData.get("id"), sortOrder: formData.get("sortOrder") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await updateMemberSortOrder(parsed.data.id, parsed.data.sortOrder);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新に失敗しました");
  }
  revalidateAll();
  return OK;
}

export async function moveMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireUser())) return fail("ログインが必要です。");
  const parsed = z
    .object({ id: z.uuid(), direction: z.enum(["up", "down"]) })
    .safeParse({
      id: formData.get("id"),
      direction: formData.get("direction"),
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await moveMember(parsed.data.id, parsed.data.direction);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "並び替えに失敗しました");
  }
  revalidateAll();
  return OK;
}

export async function setMemberActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireUser())) return fail("ログインが必要です。");
  const parsed = z
    .object({
      id: z.uuid(),
      active: z.enum(["true", "false"]).transform((v) => v === "true"),
    })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await setMemberActive(parsed.data.id, parsed.data.active);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新に失敗しました");
  }
  revalidateAll();
  return OK;
}
