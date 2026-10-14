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

  it('knows whether a longer word can follow', () => {
    expect(dict.hasLongerWord('cat')).toBe(true);
    expect(dict.hasLongerWord('cata')).toBe(true);
    expect(dict.hasLongerWord('cats')).toBe(false);
    expect(dict.hasLongerWord('dog')).toBe(false);
    expect(dict.hasLongerWord('zzz')).toBe(false);
  });

  it('parses newline-separated text', () => {
    expect(Dictionary.fromText('cat\ndog\n').size).toBe(2);
  });
});
