import { describe, expect, it } from 'vitest';
import { normalizeWord } from './word';

describe('normalizeWord', () => {
  it('lower-cases', () => {
    expect(normalizeWord('CAT')).toBe('cat');
  });

  it('treats Ё as Е', () => {
    expect(normalizeWord('ЁЖ')).toBe('еж');
    expect(normalizeWord('ёлка')).toBe('елка');
  });
});
