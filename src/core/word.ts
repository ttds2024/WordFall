export const MIN_WORD_LENGTH = 3;

/** The joker tile's letter: it stands for any one letter. */
export const JOKER = '★';

/** Normalises a word for dictionary lookup: lower case, and Ё is treated as Е. */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replaceAll('ё', 'е');
}
