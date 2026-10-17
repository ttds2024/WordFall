import type { Dictionary } from './dictionary';
import { JOKER, MIN_WORD_LENGTH, normalizeWord } from './word';

/** How the word being built looks right now. */
export type WordStatus = 'empty' | 'short' | 'valid' | 'unknown' | 'used';

/** On success, `word` is the dictionary word spelled (jokers filled in), in capitals. */
export type SubmitResult<T> =
  | { ok: true; word: string; items: T[] }
  | { ok: false; word: string; reason: Exclude<WordStatus, 'empty' | 'valid'> };

/** Collects tapped letters into a word and checks it when the player submits it. */
export class WordTracker<T extends { readonly letter: string }> {
  private picked: T[] = [];
  private readonly used = new Set<string>();
  /** The last lookup, since a word with jokers can mean scanning much of the dictionary. */
  private cache: { key: string; status: WordStatus; resolved?: string } | undefined;

  constructor(private dictionary: Dictionary | undefined) {}

  setDictionary(dictionary: Dictionary | undefined): void {
    this.dictionary = dictionary;
    this.cache = undefined;
    this.reset();
  }

  /** Whether a word (normalised) has been found this round, by the player or the bot. */
  isUsed(word: string): boolean {
    return this.used.has(normalizeWord(word));
  }

  /** Records a word found by someone else (the bot), so it cannot be scored again. */
  markUsed(word: string): void {
    this.used.add(normalizeWord(word));
    this.cache = undefined;
  }

  /** Starts over: forgets found words and the word being built. */
  reset(): void {
    this.used.clear();
    this.cache = undefined;
    this.clear();
  }

  get items(): readonly T[] {
    return this.picked;
  }

  get word(): string {
    return this.picked.map((item) => item.letter).join('');
  }

  includes(item: T): boolean {
    return this.picked.includes(item);
  }

  /** Whether `item` may join the word: not already in it, and at most one joker per word. */
  canAdd(item: T): boolean {
    if (this.includes(item)) return false;
    return item.letter !== JOKER || !this.picked.some((picked) => picked.letter === JOKER);
  }

  status(): WordStatus {
    return this.lookup().status;
  }

  /** The dictionary word a valid word spells, jokers filled in (lower case); else undefined. */
  get resolved(): string | undefined {
    return this.lookup().resolved;
  }

  /**
   * Checks the word. With jokers, it spells the first matching word not found yet; if every
   * match has been found it is 'used'.
   */
  private lookup(): { status: WordStatus; resolved?: string } {
    const word = normalizeWord(this.word);
    const key = `${word}|${this.used.size}`;
    if (this.cache?.key === key) return this.cache;
    let result: { status: WordStatus; resolved?: string };
    if (word.length === 0) result = { status: 'empty' };
    else if (word.length < MIN_WORD_LENGTH) result = { status: 'short' };
    else {
      result = { status: 'unknown' };
      for (const match of this.dictionary?.matches(word) ?? []) {
        if (!this.used.has(match)) {
          result = { status: 'valid', resolved: match };
          break;
        }
        result = { status: 'used' };
      }
    }
    this.cache = { key, ...result };
    return result;
  }

  /** Adds a letter if canAdd allows it; returns whether it was added. */
  add(item: T): boolean {
    if (!this.canAdd(item)) return false;
    this.picked.push(item);
    return true;
  }

  /** Submits the word. A valid word is recorded and cleared; anything else stays for editing. */
  submit(): SubmitResult<T> {
    const word = this.word;
    const { status, resolved } = this.lookup();
    if (status !== 'valid' || !resolved) {
      return {
        ok: false,
        word,
        reason: status === 'empty' || status === 'valid' ? 'short' : status,
      };
    }
    const items = this.picked;
    this.used.add(resolved);
    this.picked = [];
    return { ok: true, word: resolved.toUpperCase(), items };
  }

  /** Takes these items out of the word (e.g. tiles that were destroyed), keeping the rest in order. */
  remove(items: readonly T[]): void {
    this.picked = this.picked.filter((item) => !items.includes(item));
  }

  clear(): void {
    this.picked = [];
  }
}
