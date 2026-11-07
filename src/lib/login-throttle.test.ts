import { describe, expect, it } from "vitest";

import { LOCK_MS, LoginThrottle, MAX_FAILURES } from "./login-throttle";

describe("LoginThrottle（管理用コードの総当たり対策）", () => {
  const t0 = 1_700_000_000_000;

  it(`${MAX_FAILURES} 回失敗するとロックされ、時間が経てば解除される`, () => {
    const th = new LoginThrottle();
    for (let i = 1; i < MAX_FAILURES; i++) {
      expect(th.recordFailure("pc-a", t0 + i)).toBe(false);
      expect(th.lockedFor("pc-a", t0 + i)).toBe(0);
    }
    expect(th.recordFailure("pc-a", t0 + MAX_FAILURES)).toBe(true);
    expect(th.lockedFor("pc-a", t0 + MAX_FAILURES + 1000)).toBeGreaterThan(0);

    const after = t0 + MAX_FAILURES + LOCK_MS + 1;
    expect(th.lockedFor("pc-a", after)).toBe(0);
    // 解除後は数え直し
    expect(th.recordFailure("pc-a", after)).toBe(false);
  });

  it("接続元ごとに別々に数える", () => {
    const th = new LoginThrottle();
    for (let i = 0; i < MAX_FAILURES; i++) th.recordFailure("pc-a", t0);
    expect(th.lockedFor("pc-a", t0)).toBeGreaterThan(0);
    expect(th.lockedFor("pc-b", t0)).toBe(0);
  });

  it("成功すると失敗回数がリセットされる", () => {
    const th = new LoginThrottle();
    for (let i = 1; i < MAX_FAILURES; i++) th.recordFailure("pc-a", t0);
    th.recordSuccess("pc-a");
    expect(th.recordFailure("pc-a", t0)).toBe(false);
  });

  it("上限と時間を指定できる（全体の上限用）", () => {
    const th = new LoginThrottle(3, 1000);
    expect(th.recordFailure("all", t0)).toBe(false);
    expect(th.recordFailure("all", t0)).toBe(false);
    expect(th.recordFailure("all", t0)).toBe(true);
    expect(th.lockedFor("all", t0 + 999)).toBeGreaterThan(0);
    expect(th.lockedFor("all", t0 + 1001)).toBe(0);
  });

  it("最後の失敗から時間が空いたら数え直す", () => {
    const th = new LoginThrottle();
    for (let i = 1; i < MAX_FAILURES; i++) th.recordFailure("pc-a", t0);
    expect(th.recordFailure("pc-a", t0 + LOCK_MS + 1)).toBe(false);
  });
});
