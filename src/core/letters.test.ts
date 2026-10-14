import { describe, expect, it } from 'vitest';
import { LETTER_WEIGHTS, pickLetter } from './letters';

describe('LETTER_WEIGHTS', () => {
  it('covers the full alphabets, without Ё', () => {
    expect(Object.keys(LETTER_WEIGHTS.en)).toHaveLength(26);
    expect(Object.keys(LETTER_WEIGHTS.ru)).toHaveLength(32);
    expect(LETTER_WEIGHTS.ru).not.toHaveProperty('Ё');
  });
});

describe('pickLetter', () => {
  it('maps the ends of the range to the first and last letters', () => {
    expect(pickLetter('en', () => 0)).toBe('E');
    expect(pickLetter('en', () => 0.999999)).toBe('Z');
    expect(pickLetter('ru', () => 0)).toBe('О');
  });

  it('follows the weights', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const letter = pickLetter('en', random);
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    expect(counts.E!).toBeGreaterThan(counts.Z ?? 0);
    expect(counts.E! / 20000).toBeCloseTo(0.127, 1);
  });
});
