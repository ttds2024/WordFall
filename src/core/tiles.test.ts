import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Language } from '../i18n';
import { changedLetter, mulberry32, tileSpec, type TileSpec } from './tiles';

/** Tiles the multiplayer server must agree on; its tests read the same file. */
const fixture = JSON.parse(readFileSync('server/fixtures/tiles.json', 'utf8')) as (TileSpec & {
  lang: Language;
  seed: number;
  index: number;
  /** The letters magic hats turn it into, one change after another. */
  changed: string[];
})[];

describe('mulberry32', () => {
  it('gives numbers in [0, 1) and repeats for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const n = a();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(b()).toBe(n);
    }
  });
});

describe('tileSpec', () => {
  it('matches the tiles shared with the server', () => {
    for (const { lang, seed, index, changed, ...spec } of fixture) {
      expect(tileSpec(seed, index, lang)).toEqual(spec);
      expect(changed.map((_, n) => changedLetter(seed, index, lang, n + 1))).toEqual(changed);
    }
  });

  it('covers every kind of tile', () => {
    const kinds = new Set(fixture.map((tile) => tile.kind));
    expect([...kinds].sort()).toEqual([
      'bomb',
      'double',
      'ghost',
      'green',
      'hat',
      'joker',
      'pumpkin',
    ]);
  });

  it('gives a tile a new letter at every change by a magic hat', () => {
    for (let index = 0; index < 200; index++) {
      if (tileSpec(7, index, 'en').letter === '') continue;
      for (let n = 1; n <= 5; n++) {
        const letter = changedLetter(7, index, 'en', n);
        expect(letter).toMatch(/^[A-Z]$/);
        expect(letter).not.toBe(changedLetter(7, index, 'en', n - 1));
      }
    }
    expect(changedLetter(7, 3, 'en', 0)).toBe(tileSpec(7, 3, 'en').letter);
  });

  it('differs between seeds', () => {
    const letters = (seed: number) =>
      Array.from({ length: 20 }, (_, i) => tileSpec(seed, i, 'en').letter).join('');
    expect(letters(1)).not.toBe(letters(2));
  });
});
