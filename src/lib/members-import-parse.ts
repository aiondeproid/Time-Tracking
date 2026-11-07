import "server-only";

import ExcelJS from "exceljs";

import { csvRowsFromBytes } from "./members-csv";
import { rowsFromMatrix, type RawImportRow } from "./members-import";
import { xlsRowsFromBytes } from "./members-xls";

/** 対応形式かどうかを拡張子で判定する。 */
export function importExtension(filename: string): "xlsx" | "xls" | "csv" | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  if (ext === "csv") return "csv";
  return null;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return cell.text ?? "";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return String(v.result ?? "");
    return cell.text ?? "";
  }
  return String(v);
}

async function parseXlsx(bytes: Uint8Array): Promise<RawImportRow[]> {
  const wb = new ExcelJS.Workbook();
  // 正確なサイズの ArrayBuffer にしてから渡す（exceljs は Buffer|ArrayBuffer を受ける）。
  await wb.xlsx.load(bytes.slice().buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      arr[colNumber - 1] = cellText(cell);
    });
    matrix.push(arr);
  });
  return rowsFromMatrix(matrix);
}

/** アップロードされた .xlsx / .xls / .csv から取り込み対象行を抽出する。 */
export async function parseMembersFile(
  bytes: Uint8Array,
  filename: string,
): Promise<RawImportRow[]> {
  const ext = importExtension(filename);
  if (ext === "xlsx") return parseXlsx(bytes);
  if (ext === "xls") return xlsRowsFromBytes(bytes);
  if (ext === "csv") return csvRowsFromBytes(bytes);
  throw new Error("対応形式は .xlsx / .xls / .csv です");
}
