import { describe, it, expect, beforeEach } from "vitest";

import { isSignupEnabled, isValidSignupCode } from "./signup-code";

describe("isSignupEnabled", () => {
  it("SIGNUP_CODE が設定されていれば true", () => {
    process.env.SIGNUP_CODE = "let-me-in";
    expect(isSignupEnabled()).toBe(true);
  });

  it("未設定・空文字なら false", () => {
    delete process.env.SIGNUP_CODE;
    expect(isSignupEnabled()).toBe(false);
    process.env.SIGNUP_CODE = "";
    expect(isSignupEnabled()).toBe(false);
  });
});

describe("isValidSignupCode（定数時間比較）", () => {
  beforeEach(() => {
    process.env.SIGNUP_CODE = "invite-2026";
  });

  it("完全一致のみ true", () => {
    expect(isValidSignupCode("invite-2026")).toBe(true);
    expect(isValidSignupCode("invite-202")).toBe(false);
    expect(isValidSignupCode("invite-2026 ")).toBe(false);
    expect(isValidSignupCode("INVITE-2026")).toBe(false);
    expect(isValidSignupCode("")).toBe(false);
  });

  it("未設定なら常に false", () => {
    delete process.env.SIGNUP_CODE;
    expect(isValidSignupCode("invite-2026")).toBe(false);
  });
});
