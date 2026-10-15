import { describe, expect, it } from 'vitest';
import { formatTime, RoundTimer, TIMED_ROUND_MS } from './round';

describe('RoundTimer', () => {
  it('ends a timed round after 5 minutes, once', () => {
    const timer = new RoundTimer('timed');
    expect(timer.remaining).toBe(TIMED_ROUND_MS);
    expect(timer.advance(TIMED_ROUND_MS - 1)).toBe(false);
    expect(timer.remaining).toBe(1);
    expect(timer.advance(10)).toBe(true);
    expect(timer.remaining).toBe(0);
    expect(timer.advance(10)).toBe(false);
  });

  it('never ends an endless round', () => {
    const timer = new RoundTimer('endless');
    expect(timer.advance(TIMED_ROUND_MS * 10)).toBe(false);
    expect(timer.remaining).toBeUndefined();
    expect(timer.over).toBe(false);
  });
});

describe('formatTime', () => {
  it('shows minutes and seconds, rounding up', () => {
    expect(formatTime(TIMED_ROUND_MS)).toBe('5:00');
    expect(formatTime(61_000)).toBe('1:01');
    expect(formatTime(500)).toBe('0:01');
    expect(formatTime(0)).toBe('0:00');
  });
});
