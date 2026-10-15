import type { Dictionary } from './dictionary';
import { MIN_WORD_LENGTH, normalizeWord } from './word';

export type SubmitMode = 'button' | 'auto';

/** How the word being built looks right now. */
export type WordStatus = 'empty' | 'short' | 'valid' | 'unknown' | 'used';

/** On success, `word` is the dictionary word spelled (jokers filled in), in capitals. */
export type SubmitResult<T> =
  | { ok: true; word: string; items: T[] }
  | { ok: false; word: string; reason: Exclude<WordStatus, 'empty' | 'valid'> };

/** In auto mode, a valid word is submitted after this long without a new letter. */
export const AUTO_SUBMIT_DELAY_MS = 1500;

/**
 * Collects tapped letters into a word and decides when it is submitted.
 * Button mode submits only on request. Auto mode submits a valid word as soon as no longer
 * word could follow it, or after AUTO_SUBMIT_DELAY_MS with no new letter.
 */
export class WordTracker<T extends { readonly letter: string }> {
  private picked: T[] = [];
  private readonly used = new Set<string>();
  private lastAddAt = 0;
  /** The last lookup, since a word with jokers can mean scanning much of the dictionary. */
  private cache: { key: string; status: WordStatus; resolved?: string } | undefined;

  constructor(
    private dictionary: Dictionary | undefined,
    public mode: SubmitMode,
  ) {}

  setDictionary(dictionary: Dictionary | undefined): void {
    this.dictionary = dictionary;
    this.cache = undefined;
    this.reset();
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

  /** Adds a letter. In auto mode this may submit the word straight away. */
  add(item: T, now: number): SubmitResult<T> | undefined {
    if (this.includes(item)) return undefined;
    this.picked.push(item);
    this.lastAddAt = now;
    if (
      this.mode === 'auto' &&
      this.status() === 'valid' &&
      !this.dictionary?.hasLongerWord(this.word)
    ) {
      return this.submit();
    }
    return undefined;
  }

  /** Call every frame. In auto mode, submits a valid word once the player pauses. */
  update(now: number): SubmitResult<T> | undefined {
    if (
      this.mode === 'auto' &&
      this.status() === 'valid' &&
      now - this.lastAddAt >= AUTO_SUBMIT_DELAY_MS
    ) {
      return this.submit();
    }
    return undefined;
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

  clear(): void {
    this.picked = [];
  }
}
