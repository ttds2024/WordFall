import { describe, expect, it } from 'vitest';
import { ROUND_MS, RoundTimer } from './round';

describe('RoundTimer', () => {
  it('ends a round after 2 minutes, once', () => {
    for (const kind of ['solo', 'bot'] as const) {
      const timer = new RoundTimer(kind);
      expect(timer.remaining).toBe(ROUND_MS);
      expect(timer.advance(ROUND_MS - 1)).toBe(false);
      expect(timer.remaining).toBe(1);
      expect(timer.advance(10)).toBe(true);
      expect(timer.remaining).toBe(0);
      expect(timer.advance(10)).toBe(false);
    }
  });

  it('follows its clock when given one, starting after the delay', () => {
    let now = 5000;
    const timer = new RoundTimer('match', () => now, 1000);
    // Play time does not count, and nothing runs before the start.
    expect(timer.advance(ROUND_MS)).toBe(false);
    expect(timer.remaining).toBe(ROUND_MS);
    now += 1000 + 30_000;
    expect(timer.advance(0)).toBe(false);
    expect(timer.remaining).toBe(ROUND_MS - 30_000);
    now += ROUND_MS;
    expect(timer.advance(0)).toBe(true);
    expect(timer.advance(0)).toBe(false);
  });
});
