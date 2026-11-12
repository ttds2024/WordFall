import type { Language } from '../i18n';
import { pickLetter } from './letters';
import { JOKER } from './word';

/**
 * A pumpkin is an ordinary letter; a double is a letter that doubles the score of a word using
 * it; a bomb (a bad pumpkin) has no letter and explodes when it hits something; a green pumpkin
 * shows a letter but explodes when tapped; a ghost is a letter that drifts straight down through
 * the other tiles and out of the field, and is used up by a tap (it vanishes, its letter joins the
 * word); a hat (a magic hat) has no letter and, when it touches a tile, gives the letters around
 * it new ones; a joker (a star, letter JOKER) stands for any one letter.
 */
export type TileKind = 'pumpkin' | 'double' | 'bomb' | 'green' | 'ghost' | 'hat' | 'joker';

/** Share of falling tiles that are jokers. */
export const JOKER_CHANCE = 0.04;
/** Share of falling tiles that are bombs (no letter; they explode when they hit something). */
export const BOMB_CHANCE = 0.1;
/** Share of falling tiles that are ×2 letters. */
export const DOUBLE_CHANCE = 0.08;
/** Share of falling tiles that are green pumpkins (a letter; they explode when tapped). */
export const GREEN_CHANCE = 0.05;
/** Share of falling tiles that are ghost pumpkins (a letter; they pass through everything). */
export const GHOST_CHANCE = 0.05;
/** Share of falling tiles that are magic hats (no letter; they change the letters they land among). */
export const HAT_CHANCE = 0.04;

/** What the n-th tile of a round is, and where it enters: `x` is a share of the field's width. */
export interface TileSpec {
  kind: TileKind;
  letter: string;
  x: number;
}

/**
 * Mulberry32: a small 32-bit generator. The multiplayer server (server/WordFall.Server/Tiles.cs)
 * runs the same arithmetic, so both sides agree on every tile; keep the two in step.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random 32-bit round seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * The tile number `index` (from 0) of the round with this seed. Each tile has its own generator,
 * so a tile does not depend on when, or whether, the ones before it were spawned.
 */
export function tileSpec(seed: number, index: number, lang: Language): TileSpec {
  const random = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const x = random();
  const roll = random();
  if (roll < JOKER_CHANCE) return { kind: 'joker', letter: JOKER, x };
  if (roll < JOKER_CHANCE + BOMB_CHANCE) return { kind: 'bomb', letter: '', x };
  if (roll < JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE) {
    return { kind: 'double', letter: pickLetter(lang, random), x };
  }
  if (roll < JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE + GREEN_CHANCE) {
    return { kind: 'green', letter: pickLetter(lang, random), x };
  }
  if (roll < JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE + GREEN_CHANCE + GHOST_CHANCE) {
    return { kind: 'ghost', letter: pickLetter(lang, random), x };
  }
  if (
    roll <
    JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE + GREEN_CHANCE + GHOST_CHANCE + HAT_CHANCE
  ) {
    return { kind: 'hat', letter: '', x };
  }
  return { kind: 'pumpkin', letter: pickLetter(lang, random), x };
}

/**
 * The letter of tile number `index` once magic hats have changed it `changes` times. Each change
 * gives a letter other than the one before, and follows from the seed like the tile itself, so
 * both players and the server (Tiles.Letter) agree on it.
 */
export function changedLetter(
  seed: number,
  index: number,
  lang: Language,
  changes: number,
): string {
  let letter = tileSpec(seed, index, lang).letter;
  for (let n = 1; n <= changes; n++) {
    const random = mulberry32(
      (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(n, 0x85ebca6b)) >>> 0,
    );
    let next = pickLetter(lang, random);
    while (next === letter) next = pickLetter(lang, random);
    letter = next;
  }
  return letter;
}
