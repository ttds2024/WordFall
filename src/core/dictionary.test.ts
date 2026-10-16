import { describe, expect, it } from 'vitest';
import { cleanWordList, Dictionary } from './dictionary';

describe('cleanWordList', () => {
  it('keeps lower-case words of 3+ letters and drops names and abbreviations', () => {
    const text = "time\npeople\nNew\nJ.\nU.S.\nox\nit's\nwell-being\ncat\ntime\nabc1\n";
    expect(cleanWordList(text, 'en')).toEqual(['cat', 'people', 'time']);
  });

  it('folds Ё into Е for Russian and drops other alphabets', () => {
    expect(cleanWordList('ёлка\nкот\ncat\nМосква\n', 'ru')).toEqual(['елка', 'кот']);
  });
});

describe('Dictionary', () => {
  const dict = new Dictionary(['cat', 'cats', 'catalog', 'dog', 'елка']);

  it('looks words up case-insensitively, Ё as Е', () => {
    expect(dict.has('CAT')).toBe(true);
    expect(dict.has('ca')).toBe(false);
    expect(dict.has('ЁЛКА')).toBe(true);
  });

  it('matches a joker against any one letter', () => {
    expect([...dict.matches('c★t')]).toEqual(['cat']);
    expect([...dict.matches('★at')]).toEqual(['cat']);
    expect([...dict.matches('★★★')]).toEqual(['cat', 'dog']);
    expect([...dict.matches('ca★')]).toEqual(['cat']);
    expect([...dict.matches('x★z')]).toEqual([]);
    expect([...dict.matches('cat')]).toEqual(['cat']);
  });

  it('parses newline-separated text', () => {
    expect(Dictionary.fromText('cat\ndog\n').size).toBe(2);
  });
});
