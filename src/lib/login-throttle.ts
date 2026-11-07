/**
 * 管理用コードの総当たり対策。キー（接続元など）ごとに失敗回数を数え、
 * 一定回数間違えたら一定時間ロックする。
 *
 * サーバーのメモリ上で数えるだけなので、アプリを再起動するとリセットされる
 * （社内 PC 1 台で動かす前提なのでこれで十分）。
 */

/** 接続元ごとの上限: 5 回間違えたら 5 分ロック。 */
export const MAX_FAILURES = 5;
export const LOCK_MS = 5 * 60 * 1000;

/**
 * 全体の上限: 15 分以内に合計 20 回間違えたら 15 分ロック。
 * 接続元の判定に使うヘッダーは偽装できるため、接続元ごとの制限をすり抜けられても
 * 試行できる回数をここで抑える。
 */
export const GLOBAL_MAX_FAILURES = 20;
export const GLOBAL_LOCK_MS = 15 * 60 * 1000;

type Entry = { failures: number; lockedUntil: number; lastFailure: number };

export class LoginThrottle {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures: number = MAX_FAILURES,
    private readonly lockMs: number = LOCK_MS,
  ) {}

  /** ロック中なら残りミリ秒、そうでなければ 0。 */
  lockedFor(key: string, now: number = Date.now()): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    if (e.lockedUntil > now) return e.lockedUntil - now;
    if (e.lockedUntil !== 0 || now - e.lastFailure > this.lockMs) {
      // ロック明け、または最後の失敗から十分時間が経ったらリセット
      this.entries.delete(key);
    }
    return 0;
  }

  /** 失敗を記録する。今回でロックされたら true。 */
  recordFailure(key: string, now: number = Date.now()): boolean {
    this.lockedFor(key, now);
    const e = this.entries.get(key) ?? { failures: 0, lockedUntil: 0, lastFailure: 0 };
    e.failures += 1;
    e.lastFailure = now;
    if (e.failures >= this.maxFailures) e.lockedUntil = now + this.lockMs;
    this.entries.set(key, e);
    // 古いエントリを掃除（メモリが増え続けないように）
    if (this.entries.size > 1000) {
      for (const [k, v] of this.entries) {
        if (v.lockedUntil < now && now - v.lastFailure > this.lockMs) this.entries.delete(k);
      }
    }
    return e.lockedUntil > now;
  }

  /** 成功したら失敗回数をリセットする。 */
  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}
