/**
 * オープンリダイレクト防止。ローカルの絶対パス（`/...`）のみ許可し、
 * それ以外（外部 URL・プロトコル相対・空）は null を返す。
 */
export function safeNextPath(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//") || input.startsWith("/\\")) return null;
  return input;
}
