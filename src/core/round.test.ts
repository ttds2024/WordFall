import { describe, expect, it } from 'vitest';
import { formatTime, ROUND_MS, RoundTimer } from './round';

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
});

describe('formatTime', () => {
  it('shows seconds and milliseconds', () => {
    expect(ROUND_MS).toBe(120_000);
    expect(formatTime(ROUND_MS)).toBe('120.000');
    expect(formatTime(61_234.9)).toBe('61.234');
    expect(formatTime(5)).toBe('0.005');
    expect(formatTime(0)).toBe('0.000');
    expect(formatTime(-3)).toBe('0.000');
  });
});
