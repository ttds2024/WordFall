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

  it('follows another clock', () => {
    const timer = new RoundTimer('online');
    timer.sync(90_000);
    expect(timer.remaining).toBe(90_000);
    timer.sync(ROUND_MS * 2);
    expect(timer.remaining).toBe(ROUND_MS);
    timer.sync(0);
    expect(timer.over).toBe(true);
  });
});
