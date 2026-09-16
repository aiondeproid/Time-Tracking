import ExcelJS from "exceljs";

export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function disposition(asciiName: string, utf8Name: string): string {
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}

/** 取り込み用テンプレート（.xlsx / .csv）をダウンロードする。 */
export async function GET(request: Request) {
  const format =
    new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";

  if (format === "csv") {
    // UTF-8 BOM 付き。Excel でそのまま開ける。
    const csv =
      "﻿名前,読み仮名,表示順\r\n山田 太郎,やまだ たろう,10\r\n佐藤 花子,さとう はなこ,20\r\n";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": disposition(
          "members_template.csv",
          "名前リスト_テンプレート.csv",
        ),
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("名前リスト");
  ws.addRow(["名前", "読み仮名", "表示順"]);
  ws.addRow(["山田 太郎", "やまだ たろう", 10]);
  ws.addRow(["佐藤 花子", "さとう はなこ", 20]);
  ws.getRow(1).font = { bold: true };
  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 10;

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": disposition(
        "members_template.xlsx",
        "名前リスト_テンプレート.xlsx",
      ),
      "Cache-Control": "no-store",
    },
  });
}
