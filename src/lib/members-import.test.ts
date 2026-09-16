import { describe, it, expect } from "vitest";
import Encoding from "encoding-japanese";

import {
  detectColumns,
  rowsFromMatrix,
  planImport,
  type ExistingMemberLite,
} from "./members-import";
import { csvRowsFromBytes, decodeCsvBytes } from "./members-csv";

const toSjis = (s: string): Uint8Array =>
  new Uint8Array(
    Encoding.convert(Encoding.stringToCode(s), {
      to: "SJIS",
      from: "UNICODE",
      type: "array",
    }) as number[],
  );
const toUtf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("detectColumns", () => {
  it("ヘッダーから列名を認識する（読み仮名列あり）", () => {
    expect(detectColumns(["名前", "読み仮名", "表示順"])).toEqual({
      nameCol: 0,
      readingCol: 1,
      orderCol: 2,
      hasHeader: true,
    });
    expect(detectColumns(["表示順", "氏名", "ふりがな"])).toEqual({
      nameCol: 1,
      readingCol: 2,
      orderCol: 0,
      hasHeader: true,
    });
    expect(detectColumns(["Name", "Sort Order".replace(" ", "")])).toMatchObject({
      hasHeader: true,
    });
  });

  it("読み仮名列が無いヘッダーでは readingCol = -1", () => {
    expect(detectColumns(["名前", "表示順"])).toEqual({
      nameCol: 0,
      readingCol: -1,
      orderCol: 1,
      hasHeader: true,
    });
  });

  it("認識できるヘッダーが無ければ列数で判定する（2 列=名前・表示順）、ヘッダー無し", () => {
    expect(detectColumns(["山田 太郎", "10"])).toEqual({
      nameCol: 0,
      readingCol: -1,
      orderCol: 1,
      hasHeader: false,
    });
  });

  it("認識できるヘッダーが無く 3 列以上なら名前・読み仮名・表示順、ヘッダー無し", () => {
    expect(detectColumns(["山田 太郎", "やまだ たろう", "10"])).toEqual({
      nameCol: 0,
      readingCol: 1,
      orderCol: 2,
      hasHeader: false,
    });
  });
});

describe("rowsFromMatrix", () => {
  it("ヘッダーありは行番号 2 から（読み仮名列なし → reading は undefined）", () => {
    const rows = rowsFromMatrix([
      ["名前", "表示順"],
      ["山田 太郎", "10"],
      ["佐藤 花子", "20"],
    ]);
    expect(rows).toEqual([
      { rowNumber: 2, name: "山田 太郎", reading: undefined, sortOrder: "10" },
      { rowNumber: 3, name: "佐藤 花子", reading: undefined, sortOrder: "20" },
    ]);
  });

  it("読み仮名列がある場合は reading を拾う", () => {
    const rows = rowsFromMatrix([
      ["名前", "読み仮名", "表示順"],
      ["山田 太郎", "やまだ たろう", "10"],
    ]);
    expect(rows).toEqual([
      {
        rowNumber: 2,
        name: "山田 太郎",
        reading: "やまだ たろう",
        sortOrder: "10",
      },
    ]);
  });

  it("ヘッダー無しは行番号 1 から", () => {
    const rows = rowsFromMatrix([
      ["山田 太郎", "10"],
      ["佐藤 花子", "20"],
    ]);
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2]);
  });

  it("空行は除外する", () => {
    const rows = rowsFromMatrix([
      ["名前", "表示順"],
      ["", ""],
      ["山田 太郎", "10"],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "山田 太郎" });
  });
});

describe("planImport（追加 / 更新 / スキップの判定）", () => {
  const existing: ExistingMemberLite[] = [
    { id: "id-yamada", name: "山田 太郎", sort_order: 10, active: true },
    { id: "id-takahashi", name: "高橋 実", sort_order: 40, active: false },
  ];

  it("既存は更新、未知は追加（読み仮名列が無ければ reading は undefined = 変更しない）", () => {
    const plan = planImport(
      [
        { rowNumber: 2, name: "山田 太郎", reading: undefined, sortOrder: "15" },
        { rowNumber: 3, name: "新人 A", reading: undefined, sortOrder: "50" },
      ],
      existing,
    );
    expect(plan.counts).toEqual({ add: 1, update: 1, skip: 0 });
    expect(plan.add).toEqual([{ name: "新人 A", reading: "", sortOrder: 50 }]);
    expect(plan.update).toEqual([
      {
        id: "id-yamada",
        name: "山田 太郎",
        reading: undefined,
        sortOrder: 15,
        reactivate: false,
      },
    ]);
  });

  it("読み仮名列があれば、カタカナ/ローマ字入りでもひらがなに正規化して反映する", () => {
    const plan = planImport(
      [
        {
          rowNumber: 2,
          name: "山田 太郎",
          reading: "ヤマダ タロウ",
          sortOrder: "10",
        },
        {
          rowNumber: 3,
          name: "新人 A",
          reading: "shinjin a",
          sortOrder: "50",
        },
      ],
      existing,
    );
    expect(plan.update[0]).toMatchObject({ reading: "やまだ たろう" });
    expect(plan.add[0]).toMatchObject({ reading: "しんじん あ" });
  });

  it("読み仮名列はあるがセルが空 → 読み仮名を空にする（明示的なクリア）", () => {
    const plan = planImport(
      [{ rowNumber: 2, name: "山田 太郎", reading: "", sortOrder: "10" }],
      existing,
    );
    expect(plan.update[0]).toMatchObject({ reading: "" });
  });

  it("アーカイブ済みと一致したら reactivate = true", () => {
    const plan = planImport(
      [{ rowNumber: 2, name: "高橋 実", reading: undefined, sortOrder: "40" }],
      existing,
    );
    expect(plan.update[0]).toEqual({
      id: "id-takahashi",
      name: "高橋 実",
      reading: undefined,
      sortOrder: 40,
      reactivate: true,
    });
  });

  it("名前が空 / ファイル内で重複 / 表示順が数値でない はスキップ", () => {
    const plan = planImport(
      [
        { rowNumber: 2, name: "  ", reading: undefined, sortOrder: "10" },
        { rowNumber: 3, name: "田中 一", reading: undefined, sortOrder: "x" },
        { rowNumber: 4, name: "田中 二", reading: undefined, sortOrder: "" },
        {
          rowNumber: 5,
          name: "佐藤 花子",
          reading: undefined,
          sortOrder: "20",
        },
        {
          rowNumber: 6,
          name: "佐藤 花子",
          reading: undefined,
          sortOrder: "25",
        },
      ],
      existing,
    );
    expect(plan.counts).toEqual({ add: 1, update: 0, skip: 4 });
    expect(plan.skipped.map((s) => [s.rowNumber, s.reason])).toEqual([
      [2, "名前が空です"],
      [3, "表示順が数値ではありません（x）"],
      [4, "表示順が数値ではありません（空）"],
      [6, "ファイル内で名前が重複しています"],
    ]);
    expect(plan.add).toEqual([
      { name: "佐藤 花子", reading: "", sortOrder: 20 },
    ]);
  });

  it("ファイルに無い既存メンバーは計画に現れない（消さない）", () => {
    const plan = planImport(
      [{ rowNumber: 2, name: "山田 太郎", reading: undefined, sortOrder: "10" }],
      existing,
    );
    expect(plan.add).toHaveLength(0);
    expect(plan.update.map((u) => u.id)).toEqual(["id-yamada"]);
  });
});

describe("CSV パース（文字コード自動判定）", () => {
  const csv = "名前,表示順\r\n山田 太郎,10\r\n佐藤 花子,20\r\n";

  it("UTF-8 の CSV を取り込める", () => {
    const rows = csvRowsFromBytes(toUtf8(csv));
    expect(rows).toEqual([
      { rowNumber: 2, name: "山田 太郎", reading: undefined, sortOrder: "10" },
      { rowNumber: 3, name: "佐藤 花子", reading: undefined, sortOrder: "20" },
    ]);
  });

  it("Shift_JIS の CSV をそのまま取り込める", () => {
    const bytes = toSjis(csv);
    expect(decodeCsvBytes(bytes).encoding).toBe("SJIS");
    const rows = csvRowsFromBytes(bytes);
    expect(rows.map((r) => r.name)).toEqual(["山田 太郎", "佐藤 花子"]);
    expect(rows.map((r) => r.sortOrder)).toEqual(["10", "20"]);
  });

  it("UTF-8 BOM 付きでもヘッダーを認識する", () => {
    const rows = csvRowsFromBytes(toUtf8("﻿" + csv));
    expect(rows[0]).toMatchObject({ rowNumber: 2, name: "山田 太郎" });
  });

  it("ヘッダー無しの CSV（2 列）は 1 列目=名前 / 2 列目=表示順", () => {
    const rows = csvRowsFromBytes(toSjis("鈴木 一郎,30\r\n田中 実,40\r\n"));
    expect(rows).toEqual([
      { rowNumber: 1, name: "鈴木 一郎", reading: undefined, sortOrder: "30" },
      { rowNumber: 2, name: "田中 実", reading: undefined, sortOrder: "40" },
    ]);
  });

  it("ヘッダー無しの CSV（3 列）は 1 列目=名前 / 2 列目=読み仮名 / 3 列目=表示順", () => {
    const rows = csvRowsFromBytes(
      toSjis("鈴木 一郎,すずき いちろう,30\r\n"),
    );
    expect(rows).toEqual([
      {
        rowNumber: 1,
        name: "鈴木 一郎",
        reading: "すずき いちろう",
        sortOrder: "30",
      },
    ]);
  });
});
