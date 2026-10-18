import { describe, expect, it } from 'vitest';
import { formatTime, ROUND_MS, RoundTimer } from './round';

describe('RoundTimer', () => {
  it('ends a round after 5 minutes, once', () => {
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
});

describe('formatTime', () => {
  it('shows minutes and seconds, rounding up', () => {
    expect(formatTime(ROUND_MS)).toBe('5:00');
    expect(formatTime(61_000)).toBe('1:01');
    expect(formatTime(500)).toBe('0:01');
    expect(formatTime(0)).toBe('0:00');
  });
});
