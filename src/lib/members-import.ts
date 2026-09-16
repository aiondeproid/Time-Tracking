/**
 * 名前リストのファイル取り込み: 列の判定とマージ計画（純粋関数）。
 * 仕様書「4.4 名前の管理 / ファイル取り込み」。
 *
 * ファイル形式ごとのパース（.xlsx / .csv・文字コード判定）は
 * [[members-import-parse]] に分離してある。
 */

import { normalizeReading } from "./reading";

/** ファイルから取り出した 1 行分の生データ。 */
export type RawImportRow = {
  /** ファイル内の行番号（1 始まり。ヘッダーがあればデータ 1 行目は 2）。 */
  rowNumber: number;
  name: string;
  /** 読み仮名列が無いファイルでは undefined（＝読み仮名は変更しない）。 */
  reading: string | undefined;
  sortOrder: string;
};

export type SkippedRow = { rowNumber: number; name: string; reason: string };
export type PlannedAdd = { name: string; reading: string; sortOrder: number };
export type PlannedUpdate = {
  id: string;
  name: string;
  /** undefined = 読み仮名は変更しない（ファイルに読み仮名列が無い）。 */
  reading: string | undefined;
  sortOrder: number;
  /** アーカイブ済みメンバーと一致 → 再アクティブ化する。 */
  reactivate: boolean;
};

export type ImportPlan = {
  add: PlannedAdd[];
  update: PlannedUpdate[];
  skipped: SkippedRow[];
  counts: { add: number; update: number; skip: number };
};

export type ExistingMemberLite = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

const NAME_HEADERS = ["名前", "氏名", "なまえ", "name", "メンバー", "member"];
const READING_HEADERS = [
  "読み仮名",
  "よみがな",
  "ふりがな",
  "フリガナ",
  "reading",
  "furigana",
  "yomigana",
];
const ORDER_HEADERS = [
  "表示順",
  "並び順",
  "並び",
  "順番",
  "順",
  "ソート順",
  "sort",
  "sortorder",
  "sort_order",
  "order",
];

/**
 * 先頭行からヘッダーの有無と「名前」「読み仮名」「表示順」の列位置を判定する。
 * 認識できるヘッダーが無ければ、列数で判定する
 * （2 列 = 名前・表示順、3 列以上 = 名前・読み仮名・表示順、ヘッダー無し扱い）。
 * 読み仮名列が無い場合 readingCol は -1（読み仮名は変更しない、の意）。
 */
export function detectColumns(firstRow: string[]): {
  nameCol: number;
  readingCol: number;
  orderCol: number;
  hasHeader: boolean;
} {
  const norm = firstRow.map((c) => c.trim().toLowerCase());
  let nameCol = -1;
  let readingCol = -1;
  let orderCol = -1;
  norm.forEach((cell, i) => {
    if (nameCol < 0 && NAME_HEADERS.some((h) => h.toLowerCase() === cell)) {
      nameCol = i;
    }
    if (
      readingCol < 0 &&
      READING_HEADERS.some((h) => h.toLowerCase() === cell)
    ) {
      readingCol = i;
    }
    if (orderCol < 0 && ORDER_HEADERS.some((h) => h.toLowerCase() === cell)) {
      orderCol = i;
    }
  });
  if (nameCol >= 0 || readingCol >= 0 || orderCol >= 0) {
    return {
      nameCol: nameCol >= 0 ? nameCol : 0,
      readingCol,
      orderCol: orderCol >= 0 ? orderCol : readingCol === 1 ? 2 : 1,
      hasHeader: true,
    };
  }
  if (firstRow.length >= 3) {
    return { nameCol: 0, readingCol: 1, orderCol: 2, hasHeader: false };
  }
  return { nameCol: 0, readingCol: -1, orderCol: 1, hasHeader: false };
}

/** セルの二次元配列から取り込み対象行を抽出する。 */
export function rowsFromMatrix(matrix: string[][]): RawImportRow[] {
  const nonEmpty = matrix.filter((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );
  if (nonEmpty.length === 0) return [];

  const { nameCol, readingCol, orderCol, hasHeader } = detectColumns(
    nonEmpty[0].map((c) => String(c ?? "")),
  );
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty;

  return dataRows.map((row, i) => ({
    rowNumber: hasHeader ? i + 2 : i + 1,
    name: String(row[nameCol] ?? ""),
    reading: readingCol >= 0 ? String(row[readingCol] ?? "") : undefined,
    sortOrder: String(row[orderCol] ?? ""),
  }));
}

/**
 * 取り込み計画を立てる（DB は変更しない）。
 * マージ方式は「名前をキーに 追加 + 更新」。ファイルに無い名前は変更しない。
 * エラー行（名前が空 / ファイル内で重複 / 表示順が数値でない）はスキップする。
 */
export function planImport(
  rows: RawImportRow[],
  existing: ExistingMemberLite[],
): ImportPlan {
  const byName = new Map(existing.map((m) => [m.name, m]));
  const seen = new Set<string>();

  const add: PlannedAdd[] = [];
  const update: PlannedUpdate[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of rows) {
    const name = row.name.trim();
    if (name === "") {
      skipped.push({ rowNumber: row.rowNumber, name: row.name, reason: "名前が空です" });
      continue;
    }
    if (seen.has(name)) {
      skipped.push({
        rowNumber: row.rowNumber,
        name,
        reason: "ファイル内で名前が重複しています",
      });
      continue;
    }
    seen.add(name);

    const orderText = row.sortOrder.trim();
    const orderNum = Number(orderText);
    if (orderText === "" || !Number.isFinite(orderNum)) {
      skipped.push({
        rowNumber: row.rowNumber,
        name,
        reason: `表示順が数値ではありません（${row.sortOrder || "空"}）`,
      });
      continue;
    }
    const sortOrder = Math.trunc(orderNum);
    const reading =
      row.reading !== undefined ? normalizeReading(row.reading.trim()) : undefined;

    const found = byName.get(name);
    if (!found) {
      add.push({ name, reading: reading ?? "", sortOrder });
    } else {
      update.push({
        id: found.id,
        name,
        reading,
        sortOrder,
        reactivate: !found.active,
      });
    }
  }

  return {
    add,
    update,
    skipped,
    counts: { add: add.length, update: update.length, skip: skipped.length },
  };
}
