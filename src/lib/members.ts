import "server-only";

import { fetchMemberById } from "./attendance";
import { getDb, isUniqueViolation, newId, nowIso, transaction } from "./db";
import type { ImportPlan } from "./members-import";
import type { Member } from "./types";

function friendly(e: unknown): Error {
  if (isUniqueViolation(e)) return new Error("その名前は既に登録されています");
  return e instanceof Error ? e : new Error(String(e));
}

/** 1 件更新し、対象が無ければエラーにする。 */
function updateOne(sql: string, ...args: (string | number)[]): void {
  try {
    const result = getDb().prepare(sql).run(...args);
    if (Number(result.changes) === 0) throw new Error("対象のメンバーが見つかりません");
  } catch (e) {
    throw friendly(e);
  }
}

export async function insertMember(
  name: string,
  reading: string,
  team: string,
  sortOrder: number,
): Promise<Member> {
  const id = newId();
  const now = nowIso();
  try {
    getDb()
      .prepare(
        `INSERT INTO members (id, name, reading, team, sort_order, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(id, name, reading, team, sortOrder, now, now);
  } catch (e) {
    throw friendly(e);
  }
  const created = await fetchMemberById(id);
  if (!created) throw new Error("追加したメンバーが見つかりません");
  return created;
}

export async function updateMemberName(
  id: string,
  name: string,
  reading: string,
  team: string,
): Promise<void> {
  updateOne(
    "UPDATE members SET name = ?, reading = ?, team = ?, updated_at = ? WHERE id = ?",
    name,
    reading,
    team,
    nowIso(),
    id,
  );
}

export async function updateMemberSortOrder(
  id: string,
  sortOrder: number,
): Promise<void> {
  updateOne(
    "UPDATE members SET sort_order = ?, updated_at = ? WHERE id = ?",
    sortOrder,
    nowIso(),
    id,
  );
}

export async function setMemberActive(
  id: string,
  active: boolean,
): Promise<void> {
  updateOne(
    "UPDATE members SET active = ?, updated_at = ? WHERE id = ?",
    active ? 1 : 0,
    nowIso(),
    id,
  );
}

/**
 * 表示順の入れ替え。現在の並び（sort_order → name）で id の 1 つ上/下と
 * sort_order の値を交換する。両者が同値なら片方をずらす。端なら何もしない。
 */
export async function moveMember(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  transaction((db) => {
    const list = db
      .prepare("SELECT id, sort_order, name FROM members ORDER BY sort_order ASC, name ASC")
      .all() as { id: string; sort_order: number; name: string }[];

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

    const now = nowIso();
    const stmt = db.prepare("UPDATE members SET sort_order = ?, updated_at = ? WHERE id = ?");
    stmt.run(currentNew, now, current.id);
    stmt.run(targetNew, now, target.id);
  });
}

/** 取り込み計画を DB に反映する（全件を 1 トランザクションで。途中で失敗したら何も変えない）。 */
export async function applyImportPlan(
  plan: ImportPlan,
): Promise<{ added: number; updated: number }> {
  try {
    transaction((db) => {
      const now = nowIso();

      const insert = db.prepare(
        `INSERT INTO members (id, name, reading, team, sort_order, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      );
      for (const a of plan.add) {
        insert.run(newId(), a.name, a.reading, a.team, a.sortOrder, now, now);
      }

      for (const u of plan.update) {
        const sets = ["sort_order = ?", "updated_at = ?"];
        const args: (string | number)[] = [u.sortOrder, now];
        if (u.reactivate) sets.push("active = 1");
        if (u.reading !== undefined) {
          sets.push("reading = ?");
          args.push(u.reading);
        }
        if (u.team !== undefined) {
          sets.push("team = ?");
          args.push(u.team);
        }
        args.push(u.id);
        db.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ?`).run(...args);
      }
    });
  } catch (e) {
    throw friendly(e);
  }

  return { added: plan.add.length, updated: plan.update.length };
}
