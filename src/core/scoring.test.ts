import { describe, expect, it } from 'vitest';
import { LETTER_VALUES, scoreWord, SKULL_MULTIPLIER, wordMultiplier } from './scoring';

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

describe('wordMultiplier', () => {
  const pumpkin = { kind: 'pumpkin' };
  const skull = { kind: 'skull' };

  it('is 1 for pumpkins only', () => {
    expect(wordMultiplier([pumpkin, pumpkin, pumpkin])).toBe(1);
    expect(wordMultiplier([])).toBe(1);
  });

  it('doubles a word with a skull, however many skulls it has', () => {
    expect(wordMultiplier([pumpkin, skull, pumpkin])).toBe(SKULL_MULTIPLIER);
    expect(wordMultiplier([skull, skull, skull])).toBe(2);
  });
});

describe('jokers', () => {
  it('score nothing, like a blank', () => {
    expect(scoreWord('C★T', 'en')).toBe(4);
  });
});
