import { getSessionUser } from "@/lib/auth";
import { fetchAllMembers } from "@/lib/attendance";
import { applyImportPlan } from "@/lib/members";
import { planImport } from "@/lib/members-import";
import { parseMembersFile } from "@/lib/members-import-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * 名前リストのファイル取り込み。`mode=preview` で計画（追加 n / 更新 m /
 * スキップ k）を返し、`mode=commit` で反映する。commit も毎回ファイルを
 * 解析し直すので、プレビュー結果の改ざんは効かない。
 * ログイン必須。外周はサイト共通合言葉ゲート。
 */
export async function POST(request: Request) {
  if (!(await getSessionUser())) {
    return Response.json(
      { ok: false, error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode") === "commit" ? "commit" : "preview";

  if (!(file instanceof File)) {
    return Response.json(
      { ok: false, error: "ファイルが選択されていません。" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { ok: false, error: "ファイルが大きすぎます（2MB まで）。" },
      { status: 400 },
    );
  }

  let rawRows;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    rawRows = await parseMembersFile(bytes, file.name);
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "ファイルの解析に失敗しました。",
      },
      { status: 400 },
    );
  }

  const existing = await fetchAllMembers();
  const plan = planImport(
    rawRows,
    existing.map((m) => ({
      id: m.id,
      name: m.name,
      sort_order: m.sort_order,
      active: m.active,
    })),
  );

  if (mode === "commit") {
    try {
      const result = await applyImportPlan(plan);
      return Response.json({
        ok: true,
        committed: true,
        counts: plan.counts,
        skipped: plan.skipped,
        result,
      });
    } catch (e) {
      return Response.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : "取り込みに失敗しました。",
        },
        { status: 500 },
      );
    }
  }

  return Response.json({
    ok: true,
    committed: false,
    counts: plan.counts,
    skipped: plan.skipped,
    addNames: plan.add.map((a) => a.name),
    updates: plan.update.map((u) => ({ name: u.name, reactivate: u.reactivate })),
  });
}
