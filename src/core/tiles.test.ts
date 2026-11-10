import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Language } from '../i18n';
import { mulberry32, tileSpec, type TileSpec } from './tiles';

/** Tiles the multiplayer server must agree on; its tests read the same file. */
const fixture = JSON.parse(readFileSync('server/fixtures/tiles.json', 'utf8')) as (TileSpec & {
  lang: Language;
  seed: number;
  index: number;
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
    for (const { lang, seed, index, ...spec } of fixture) {
      expect(tileSpec(seed, index, lang)).toEqual(spec);
    }
  });

  it('covers every kind of tile', () => {
    const kinds = new Set(fixture.map((tile) => tile.kind));
    expect([...kinds].sort()).toEqual(['bomb', 'double', 'green', 'joker', 'pumpkin']);
  });

  it('differs between seeds', () => {
    const letters = (seed: number) =>
      Array.from({ length: 20 }, (_, i) => tileSpec(seed, i, 'en').letter).join('');
    expect(letters(1)).not.toBe(letters(2));
  });
});
