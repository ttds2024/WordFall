import type { Language } from '../i18n/index.ts';
import { MIN_WORD_LENGTH, normalizeWord } from './word.ts';

const ALPHABET: Record<Language, RegExp> = {
  en: /^[a-z]+$/,
  ru: /^[а-я]+$/,
};

/**
 * Turns a raw word list (one word per line) into playable words: lower-case letters of the
 * language's alphabet only, at least MIN_WORD_LENGTH long, Ё folded into Е, no duplicates.
 * Entries with capitals, digits or punctuation (names, abbreviations) are dropped.
 */
export function cleanWordList(text: string, lang: Language): string[] {
  const words = new Set<string>();
  for (const line of text.split('\n')) {
    const raw = line.trim();
    if (raw !== raw.toLowerCase()) continue;
    const word = normalizeWord(raw);
    if (word.length >= MIN_WORD_LENGTH && ALPHABET[lang].test(word)) words.add(word);
  }
  return [...words].sort();
}

/** Fast lookups over a sorted word list. Words are compared after normalizeWord. */
export class Dictionary {
  private readonly words: readonly string[];
  private readonly set: ReadonlySet<string>;

  constructor(words: readonly string[]) {
    this.words = [...words].map(normalizeWord).sort();
    this.set = new Set(this.words);
  }

  static fromText(text: string): Dictionary {
    return new Dictionary(text.split('\n').filter(Boolean));
  }

  get size(): number {
    return this.set.size;
  }

  has(word: string): boolean {
    return this.set.has(normalizeWord(word));
  }

  /** Whether some longer word starts with `prefix`. */
  hasLongerWord(prefix: string): boolean {
    const p = normalizeWord(prefix);
    let lo = 0;
    let hi = this.words.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.words[mid]! <= p) lo = mid + 1;
      else hi = mid;
    }
    return lo < this.words.length && this.words[lo]!.startsWith(p);
  }
}
