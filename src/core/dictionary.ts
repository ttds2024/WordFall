import type { Language } from '../i18n/index.ts';
import { JOKER, MIN_WORD_LENGTH, normalizeWord } from './word.ts';

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

  /** Whether some longer word starts with `prefix`. A JOKER in it stands for any one letter. */
  hasLongerWord(prefix: string): boolean {
    const p = normalizeWord(prefix);
    for (const word of this.startingWith(p)) if (word.length > p.length) return true;
    return false;
  }

  /** The words `pattern` can spell, alphabetically; a JOKER in it stands for any one letter. */
  *matches(pattern: string): Generator<string> {
    const p = normalizeWord(pattern);
    for (const word of this.startingWith(p)) if (word.length === p.length) yield word;
  }

  /** Words whose start fits `p` (already normalised), found from the letters before any joker. */
  private *startingWith(p: string): Generator<string> {
    const jokerAt = p.indexOf(JOKER);
    const fixed = jokerAt === -1 ? p : p.slice(0, jokerAt);
    for (let i = this.lowerBound(fixed); i < this.words.length; i++) {
      const word = this.words[i]!;
      if (!word.startsWith(fixed)) return;
      if (jokerAt === -1 || fits(word, p)) yield word;
    }
  }

  /** Index of the first word not before `p`. */
  private lowerBound(p: string): number {
    let lo = 0;
    let hi = this.words.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.words[mid]! < p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/** Whether `word` starts with `pattern`, a JOKER matching any one letter. */
function fits(word: string, pattern: string): boolean {
  if (word.length < pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== JOKER && pattern[i] !== word[i]) return false;
  }
  return true;
}
