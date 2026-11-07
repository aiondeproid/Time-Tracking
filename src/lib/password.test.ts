import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("パスワードのハッシュ化（hashPassword / verifyPassword）", () => {
  it("正しいパスワードだけが一致する", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("平文は保存形式に含まれず、同じパスワードでも毎回ソルトが変わる", async () => {
    const a = await hashPassword("s3cr3t-pass");
    const b = await hashPassword("s3cr3t-pass");
    expect(a).not.toContain("s3cr3t-pass");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toBe(b);
    expect(await verifyPassword("s3cr3t-pass", b)).toBe(true);
  });

  it("壊れた保存値は常に不一致", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "plain-text")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$8$1$AAAA$")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$a$b$c$d$e")).toBe(false);
  });
});
