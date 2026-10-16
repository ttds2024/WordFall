import type { Language } from '../i18n';
import { normalizeWord } from './word';

/** Temporary v1 letter values: Scrabble for English, Эрудит for Russian. */
// prettier-ignore
export const LETTER_VALUES: Record<Language, Readonly<Record<string, number>>> = {
  en: {
    a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
    n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
  },
  ru: {
    а: 1, б: 3, в: 2, г: 3, д: 2, е: 1, ж: 5, з: 5, и: 1, й: 2, к: 2, л: 2, м: 2, н: 1,
    о: 1, п: 2, р: 2, с: 2, т: 2, у: 3, ф: 10, х: 5, ц: 10, ч: 5, ш: 10, щ: 10, ъ: 10,
    ы: 5, ь: 5, э: 10, ю: 10, я: 3,
  },
};

export function scoreWord(word: string, lang: Language): number {
  let score = 0;
  for (const letter of normalizeWord(word)) score += LETTER_VALUES[lang][letter] ?? 0;
  return score;
}
