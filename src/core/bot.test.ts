import { describe, expect, it } from 'vitest';
import { BOT_MAX_MS, BOT_MIN_MS, BotClock, findWord, pickMiss } from './bot';

const WORDS = ['cat', 'cats', 'dog', 'act', 'tact'];

describe('BotClock', () => {
  it('fires every 6 to 10 seconds of play', () => {
    const clock = new BotClock(() => 0.5);
    const gap = (BOT_MIN_MS + BOT_MAX_MS) / 2;
    expect(clock.advance(gap - 1)).toBe(false);
    expect(clock.advance(1)).toBe(true);
    expect(clock.advance(gap - 1)).toBe(false);
    expect(clock.advance(1)).toBe(true);
  });
});

describe('findWord', () => {
  const letters = ['T', 'C', 'X', 'A'];

  it('spells a dictionary word from the letters on the field', () => {
    const found = findWord(
      letters,
      WORDS,
      () => false,
      () => 0,
    )!;
    const word = found.map((i) => letters[i]).join('');
    expect(['CAT', 'ACT']).toContain(word);
    expect(new Set(found).size).toBe(3);
  });

  it('skips words already found and words it lacks letters for', () => {
    const found = findWord(
      letters,
      WORDS,
      (w) => w === 'cat',
      () => 0,
    )!;
    expect(found.map((i) => letters[i]).join('')).toBe('ACT');
    expect(findWord(letters, WORDS, () => true)).toBeUndefined();
    expect(findWord(['D', 'O'], WORDS, () => false)).toBeUndefined();
  });

  it('uses a repeated letter only as often as it is on the field', () => {
    expect(findWord(['T', 'A', 'C'], ['tact'], () => false)).toBeUndefined();
    const found = findWord(['T', 'A', 'C', 'T'], ['tact'], () => false)!;
    expect(found.sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('pickMiss', () => {
  it('picks letters that do not spell a word', () => {
    const letters = ['C', 'A', 'T', 'Q', 'Z'];
    const isWord = (w: string) => WORDS.includes(w.toLowerCase());
    for (let i = 0; i < 20; i++) {
      const miss = pickMiss(letters, isWord)!;
      expect(miss.length).toBeGreaterThanOrEqual(3);
      expect(isWord(miss.map((j) => letters[j]).join(''))).toBe(false);
    }
  });

  it('needs enough letters', () => {
    expect(pickMiss(['A', 'B'], () => false)).toBeUndefined();
  });
});
