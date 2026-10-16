import { describe, expect, it } from 'vitest';
import { LETTER_VALUES, scoreWord } from './scoring';

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
