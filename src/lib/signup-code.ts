/**
 * ユーザー登録の招待コード（環境変数 `SIGNUP_CODE`）。
 *
 * 「名前の管理」はログイン必須にした（[[auth]]）。誰でもアカウントを作れると
 * サイト共通合言葉ゲート（[[gate]]）と同じ強度に落ちるため、登録には
 * サーバー専用の `SIGNUP_CODE` を要求する。実際のユーザー作成は
 * サーバーアクションが service_role（`admin.createUser`）で行うので、
 * このコードを知らなければ anon キーで直接 Supabase を叩いても作成できない。
 *
 * 依存は `node:crypto` のみ（テストしやすいよう純粋関数に閉じる）。
 */
import { timingSafeEqual } from "node:crypto";

/** サーバー側で `SIGNUP_CODE` が設定されているか。 */
export function isSignupEnabled(): boolean {
  return (process.env.SIGNUP_CODE ?? "").length > 0;
}

/** 入力された登録用コードが `SIGNUP_CODE` と一致するか（定数時間比較）。 */
export function isValidSignupCode(input: string): boolean {
  const expected = process.env.SIGNUP_CODE ?? "";
  if (expected.length === 0) return false;
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
