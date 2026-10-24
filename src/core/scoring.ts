import { normalizeWord } from './word';

/** Points for each letter of a word, whatever the letter. */
export const POINTS_PER_LETTER = 100;

/** Each ×2 tile in a word adds this much to its multiplier: N of them make it ×(N × 2). */
export const DOUBLE_MULTIPLIER = 2;

/** A word scores 100 per letter; a joker counts as the letter it stands for. */
export function scoreWord(word: string): number {
  return [...normalizeWord(word)].length * POINTS_PER_LETTER;
}

/** Multiplier for a word built from these tiles: 1 with no ×2 tile, else 2 × the number of them. */
export function wordMultiplier(tiles: readonly { readonly kind: string }[]): number {
  const doubles = tiles.filter((tile) => tile.kind === 'double').length;
  return doubles === 0 ? 1 : doubles * DOUBLE_MULTIPLIER;
}
