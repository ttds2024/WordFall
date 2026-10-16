import { describe, expect, it } from 'vitest';
import { DOUBLE_MULTIPLIER, LETTER_VALUES, scoreWord, wordMultiplier } from './scoring';

describe('scoreWord', () => {
  it('adds Scrabble values in English', () => {
    expect(scoreWord('QUIZ', 'en')).toBe(22);
    expect(scoreWord('cat', 'en')).toBe(5);
  });

  it('adds Эрудит values in Russian, Ё as Е', () => {
    expect(scoreWord('кот', 'ru')).toBe(5);
    expect(scoreWord('ёж', 'ru')).toBe(6);
  });

  it('covers both alphabets', () => {
    expect(Object.keys(LETTER_VALUES.en)).toHaveLength(26);
    expect(Object.keys(LETTER_VALUES.ru)).toHaveLength(32);
  });
});

describe('jokers', () => {
  it('score nothing, like a blank', () => {
    expect(scoreWord('C★T', 'en')).toBe(4);
  });
});

describe('wordMultiplier', () => {
  const pumpkin = { kind: 'pumpkin' };
  const double = { kind: 'double' };

  it('is 1 for ordinary letters', () => {
    expect(wordMultiplier([pumpkin, pumpkin, pumpkin])).toBe(1);
    expect(wordMultiplier([])).toBe(1);
  });

  it('doubles a word with a ×2 tile, however many it has', () => {
    expect(wordMultiplier([pumpkin, double, pumpkin])).toBe(DOUBLE_MULTIPLIER);
    expect(wordMultiplier([double, double, double])).toBe(2);
  });
});
