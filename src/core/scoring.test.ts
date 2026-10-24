import { describe, expect, it } from 'vitest';
import { DOUBLE_MULTIPLIER, scoreWord, wordMultiplier } from './scoring';

describe('scoreWord', () => {
  it('scores 100 per letter, whatever the letters', () => {
    expect(scoreWord('QUIZ')).toBe(400);
    expect(scoreWord('cat')).toBe(300);
    expect(scoreWord('кот')).toBe(300);
    expect(scoreWord('ёжик')).toBe(400);
  });

  it('counts a joker as a letter', () => {
    expect(scoreWord('C★T')).toBe(300);
  });
});

describe('wordMultiplier', () => {
  const pumpkin = { kind: 'pumpkin' };
  const double = { kind: 'double' };

  it('is 1 for ordinary letters', () => {
    expect(wordMultiplier([pumpkin, pumpkin, pumpkin])).toBe(1);
    expect(wordMultiplier([])).toBe(1);
  });

  it('multiplies by 2 for each ×2 tile: N of them make ×(N × 2)', () => {
    expect(wordMultiplier([pumpkin, double, pumpkin])).toBe(DOUBLE_MULTIPLIER);
    expect(wordMultiplier([double, pumpkin, double])).toBe(4);
    expect(wordMultiplier([double, double, double])).toBe(6);
  });
});
