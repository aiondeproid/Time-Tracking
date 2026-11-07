import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next";

describe("safeNextPath（オープンリダイレクト防止）", () => {
  it("ローカル絶対パスは許可", () => {
    expect(safeNextPath("/list")).toBe("/list");
    expect(safeNextPath("/list?from=2026-09-01&name=%E5%B1%B1%E7%94%B0")).toBe(
      "/list?from=2026-09-01&name=%E5%B1%B1%E7%94%B0",
    );
  });

  it("外部 URL・プロトコル相対・非パスは null", () => {
    expect(safeNextPath("//evil.example.com")).toBeNull();
    expect(safeNextPath("/\\evil.example.com")).toBeNull();
    expect(safeNextPath("https://evil.example.com")).toBeNull();
    expect(safeNextPath("list")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(123)).toBeNull();
  });
});
