import "server-only";

import type { ImportPlan } from "./members-import";
import { createServiceRoleClient } from "./supabase/server";
import type { Member } from "./types";

type PgError = { code?: string; message: string };

function friendly(error: PgError): Error {
  if (error.code === "23505") return new Error("その名前は既に登録されています");
  return new Error(error.message);
}

export async function insertMember(
  name: string,
  reading: string,
  sortOrder: number,
): Promise<Member> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("members")
    .insert({ name, reading, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw friendly(error);
  return data as Member;
}

export async function updateMemberName(
  id: string,
  name: string,
  reading: string,
): Promise<void> {
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("members")
    .update({ name, reading })
    .eq("id", id);
  if (error) throw friendly(error);
}

export async function updateMemberSortOrder(
  id: string,
  sortOrder: number,
): Promise<void> {
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("members")
    .update({ sort_order: sortOrder })
    .eq("id", id);
  if (error) throw friendly(error);
}

export async function setMemberActive(
  id: string,
  active: boolean,
): Promise<void> {
  const sb = createServiceRoleClient();
  const { error } = await sb.from("members").update({ active }).eq("id", id);
  if (error) throw friendly(error);
}

/**
 * 表示順の入れ替え。現在の並び（sort_order → name）で id の 1 つ上/下と
 * sort_order の値を交換する。両者が同値なら片方をずらす。端なら何もしない。
 */
export async function moveMember(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("members")
    .select("id, sort_order, name")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw friendly(error);

  const list = (data ?? []) as { id: string; sort_order: number; name: string }[];
  const index = list.findIndex((m) => m.id === id);
  if (index < 0) throw new Error("対象のメンバーが見つかりません");

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return; // 端

  const current = list[index];
  const target = list[targetIndex];
  let currentNew = target.sort_order;
  let targetNew = current.sort_order;
  if (currentNew === targetNew) {
    currentNew = direction === "up" ? target.sort_order - 1 : target.sort_order + 1;
    targetNew = current.sort_order;
  }

  const r1 = await sb
    .from("members")
    .update({ sort_order: currentNew })
    .eq("id", current.id);
  if (r1.error) throw friendly(r1.error);
  const r2 = await sb
    .from("members")
    .update({ sort_order: targetNew })
    .eq("id", target.id);
  if (r2.error) throw friendly(r2.error);
}

/** 取り込み計画を DB に反映する。 */
export async function applyImportPlan(
  plan: ImportPlan,
): Promise<{ added: number; updated: number }> {
  const sb = createServiceRoleClient();

  if (plan.add.length > 0) {
    const { error } = await sb
      .from("members")
      .insert(
        plan.add.map((a) => ({ name: a.name, sort_order: a.sortOrder })),
      );
    if (error) throw friendly(error);
  }

  for (const u of plan.update) {
    const patch: { sort_order: number; active?: boolean } = {
      sort_order: u.sortOrder,
    };
    if (u.reactivate) patch.active = true;
    const { error } = await sb.from("members").update(patch).eq("id", u.id);
    if (error) throw friendly(error);
  }

  return { added: plan.add.length, updated: plan.update.length };
}
