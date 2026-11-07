/**
 * 旧形式の Excel ファイル（.xls / Excel 97-2003 など）を読み込む。
 *
 * exceljs は .xls を読めないため、SheetJS（`xlsx`）を使う。
 * npm レジストリの xlsx 0.18.5 には既知の脆弱性があるため、公式配布
 * （https://cdn.sheetjs.com）の修正版を package.json で指定している。
 *
 * Excel 95 以前の形式は文字コード（Shift_JIS など）の変換表が必要なので
 * `cpexcel` を登録しておく。Excel 97-2003 形式は UTF-16 なので変換表なしでも読める。
 *
 * サーバー専用ではない純粋な処理なので、テストから直接呼べる。
 */
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";

import { rowsFromMatrix, type RawImportRow } from "./members-import";

XLSX.set_cptable(cptable);

/** .xls の先頭シートを文字列の 2 次元配列にしてから取り込み行に変換する。 */
export function xlsRowsFromBytes(bytes: Uint8Array): RawImportRow[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, {
      type: "array",
      // 数式・書式・図形などは不要。値だけ読む（重いファイルでも速く・安全に）。
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      bookVBA: false,
      sheets: 0,
    });
  } catch {
    throw new Error(".xls ファイルを読み込めませんでした。ファイルが壊れていないか確認してください。");
  }

  const name = wb.SheetNames[0];
  const ws = name ? wb.Sheets[name] : undefined;
  if (!ws) return [];

  // raw: false = 画面に見えている表示どおりの文字列で受け取る（表示順の数値も "10" になる）。
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return rowsFromMatrix(matrix.map((row) => row.map((v) => (v == null ? "" : String(v)))));
}
