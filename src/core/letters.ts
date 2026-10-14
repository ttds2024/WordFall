import type { Language } from '../i18n';

/**
 * Relative letter frequencies in ordinary text (percent). Temporary v1 weights.
 * Russian Ё is folded into Е, so it never appears as a tile.
 */
// prettier-ignore
export const LETTER_WEIGHTS: Record<Language, Readonly<Record<string, number>>> = {
  en: {
    E: 12.7, T: 9.1, A: 8.2, O: 7.5, I: 7.0, N: 6.7, S: 6.3, H: 6.1, R: 6.0, D: 4.3,
    L: 4.0, C: 2.8, U: 2.8, M: 2.4, W: 2.4, F: 2.2, G: 2.0, Y: 2.0, P: 1.9, B: 1.5,
    V: 1.0, K: 0.8, J: 0.15, X: 0.15, Q: 0.1, Z: 0.07,
  },
  ru: {
    О: 10.97, Е: 8.49, А: 8.01, И: 7.35, Н: 6.7, Т: 6.26, С: 5.47, Р: 4.73, В: 4.54,
    Л: 4.4, К: 3.49, М: 3.21, Д: 2.98, П: 2.81, У: 2.62, Я: 2.01, Ы: 1.9, Ь: 1.74,
    Г: 1.7, З: 1.65, Б: 1.59, Ч: 1.44, Й: 1.21, Х: 0.97, Ж: 0.94, Ш: 0.73, Ю: 0.64,
    Ц: 0.48, Щ: 0.36, Э: 0.32, Ф: 0.26, Ъ: 0.04,
  },
};

/** Picks a random letter, weighted by frequency. `random` returns a number in [0, 1). */
export function pickLetter(lang: Language, random: () => number = Math.random): string {
  const entries = Object.entries(LETTER_WEIGHTS[lang]);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [letter, weight] of entries) {
    r -= weight;
    if (r < 0) return letter;
  }
  return entries[entries.length - 1]![0];
}
