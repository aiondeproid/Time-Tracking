"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Skipped = { rowNumber: number; name: string; reason: string };

type PreviewResult = {
  counts: { add: number; update: number; skip: number };
  skipped: Skipped[];
  addNames: string[];
  updates: { name: string; reactivate: boolean }[];
};

const btn =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
const btnGhost =
  "rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20";

export function ImportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function resetFeedback() {
    setPreview(null);
    setError(null);
    setDone(null);
  }

  async function send(mode: "preview" | "commit") {
    if (!file) return;
    setBusy(mode);
    setError(null);
    setDone(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mode", mode);
      const res = await fetch("/api/members/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "取り込みに失敗しました。");
        return;
      }
      if (mode === "preview") {
        setPreview({
          counts: json.counts,
          skipped: json.skipped,
          addNames: json.addNames,
          updates: json.updates,
        });
      } else {
        setPreview(null);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setDone(
          `取り込み完了 — 追加 ${json.result.added} 件 / 更新 ${json.result.updated} 件 / スキップ ${json.counts.skip} 件`,
        );
        router.refresh();
      }
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  const reactivating = preview?.updates.filter((u) => u.reactivate) ?? [];
  const nothingToApply =
    preview != null && preview.counts.add === 0 && preview.counts.update === 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <h2 className="text-sm font-semibold">ファイルから取り込み（.xlsx / .csv）</h2>
      <p className="text-xs leading-relaxed text-zinc-500">
        「名前」「読み仮名」「表示順」の列。読み仮名は任意で、勤怠入力の名前検索を
        ひらがな・カタカナ・ローマ字でも予測できるようにするためのものです（列が無い
        ファイルを取り込んでも、既存メンバーの読み仮名は変更しません）。名前をキーに{" "}
        <b>追加 + 更新</b>（ファイルに無い名前は変更しません）。ヘッダー行から列名を
        認識し、無ければ列数から 名前・表示順（2 列）/ 名前・読み仮名・表示順（3 列）
        を判定します。CSV の文字コード（UTF-8 / Shift_JIS）は自動判定します。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            resetFeedback();
          }}
          className="text-sm"
        />
        <button
          type="button"
          disabled={!file || busy !== null}
          onClick={() => send("preview")}
          className={btnGhost + " disabled:opacity-50"}
        >
          {busy === "preview" ? "確認中…" : "プレビュー"}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        テンプレート:
        <a
          href="/api/members/template?format=xlsx"
          className="underline underline-offset-2"
        >
          .xlsx
        </a>
        <a
          href="/api/members/template?format=csv"
          className="underline underline-offset-2"
        >
          .csv
        </a>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{done}</p>
      )}

      {preview && (
        <div className="flex flex-col gap-2 rounded-md border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/15 dark:bg-white/[.03]">
          <p>
            追加 <strong>{preview.counts.add}</strong> 件 ／ 更新{" "}
            <strong>{preview.counts.update}</strong> 件 ／ スキップ{" "}
            <strong>{preview.counts.skip}</strong> 件
          </p>
          {preview.addNames.length > 0 && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              追加: {preview.addNames.join("、")}
            </p>
          )}
          {reactivating.length > 0 && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              再アクティブ化: {reactivating.map((u) => u.name).join("、")}
            </p>
          )}
          {preview.skipped.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-500">
                スキップした行:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {preview.skipped.map((s, i) => (
                  <li key={i}>
                    {s.rowNumber} 行目「{s.name || "(空)"}」— {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={busy !== null || nothingToApply}
              onClick={() => send("commit")}
              className={btn}
            >
              {busy === "commit" ? "取り込み中…" : "この内容で取り込む"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className={btnGhost}
            >
              やめる
            </button>
          </div>
          {nothingToApply && (
            <p className="text-xs text-zinc-500">
              反映できる行がありません。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
