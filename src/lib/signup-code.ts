/**
 * 「名前の管理」を開くための管理用コード（環境変数 `SIGNUP_CODE`）。
 *
 * ログイン画面でこのコードを入力するとセッションが発行される（[[auth]]）。
 *
 * 依存は `node:crypto` のみ（テストしやすいよう純粋関数に閉じる）。
 */
import { timingSafeEqual } from "node:crypto";

/** サーバー側で `SIGNUP_CODE` が設定されているか。 */
export function isSignupEnabled(): boolean {
  return (process.env.SIGNUP_CODE ?? "").length > 0;
}

/** 入力されたコードが `SIGNUP_CODE` と一致するか（定数時間比較）。 */
export function isValidSignupCode(input: string): boolean {
  const expected = process.env.SIGNUP_CODE ?? "";
  if (expected.length === 0) return false;
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
