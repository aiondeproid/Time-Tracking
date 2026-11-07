import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { xlsRowsFromBytes } from "./members-xls";

/** テスト用に .xls（BIFF）形式のファイルをメモリ上で作る。 */
function makeXls(rows: (string | number)[][], bookType: "biff8" | "biff5" = "biff8"): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "メンバー");
  const out = XLSX.write(wb, { type: "array", bookType }) as ArrayBuffer;
  return new Uint8Array(out);
}

describe(".xls の読み込み（xlsRowsFromBytes）", () => {
  it("Excel 97-2003 形式: 日本語の名前・読み仮名・数値の表示順を読める", () => {
    const bytes = makeXls([
      ["名前", "読み仮名", "表示順"],
      ["山田 太郎", "やまだ たろう", 10],
      ["佐藤 花子", "", 20],
    ]);
    expect(xlsRowsFromBytes(bytes)).toEqual([
      { rowNumber: 2, name: "山田 太郎", reading: "やまだ たろう", sortOrder: "10" },
      { rowNumber: 3, name: "佐藤 花子", reading: "", sortOrder: "20" },
    ]);
  });

  it("ヘッダー無し 2 列（名前・表示順）も判定できる", () => {
    const bytes = makeXls([
      ["鈴木 一郎", 5],
      ["高橋 実", 15],
    ]);
    expect(xlsRowsFromBytes(bytes)).toEqual([
      { rowNumber: 1, name: "鈴木 一郎", reading: undefined, sortOrder: "5" },
      { rowNumber: 2, name: "高橋 実", reading: undefined, sortOrder: "15" },
    ]);
  });

  it("Excel 95 形式（BIFF5）も読める", () => {
    // SheetJS の BIFF5 書き出しは日本語を書けないため、テストデータは英字にする
    // （読み込み側は cpexcel を登録しているので Shift_JIS の実ファイルも読める）。
    const bytes = makeXls(
      [
        ["Tanaka", 1],
        ["Suzuki", 2],
      ],
      "biff5",
    );
    expect(xlsRowsFromBytes(bytes)).toEqual([
      { rowNumber: 1, name: "Tanaka", reading: undefined, sortOrder: "1" },
      { rowNumber: 2, name: "Suzuki", reading: undefined, sortOrder: "2" },
    ]);
  });

  it("拡張子だけ .xls で中身が HTML の表（社内システムの書き出しでよくある形）も読める", () => {
    const html =
      '<html><meta charset="utf-8"><body><table>' +
      "<tr><td>名前</td><td>表示順</td></tr>" +
      "<tr><td>山田 太郎</td><td>10</td></tr>" +
      "</table></body></html>";
    expect(xlsRowsFromBytes(new TextEncoder().encode(html))).toEqual([
      { rowNumber: 2, name: "山田 太郎", reading: undefined, sortOrder: "10" },
    ]);
  });
});
