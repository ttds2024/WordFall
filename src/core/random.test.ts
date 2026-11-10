import { describe, expect, it } from 'vitest';
import { seededRandom } from './random';

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, all in [0, 1)', () => {
    const a = seededRandom(12345);
    const b = seededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const n = a();
      expect(n).toBe(b());
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('gives different numbers for different seeds', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
});
