import type { Dictionary } from './dictionary';
import { MIN_WORD_LENGTH, normalizeWord } from './word';

export type SubmitMode = 'button' | 'auto';

/** How the word being built looks right now. */
export type WordStatus = 'empty' | 'short' | 'valid' | 'unknown' | 'used';

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

  constructor(
    private dictionary: Dictionary | undefined,
    public mode: SubmitMode,
  ) {}

  setDictionary(dictionary: Dictionary | undefined): void {
    this.dictionary = dictionary;
    this.reset();
  }

  /** Starts over: forgets found words and the word being built. */
  reset(): void {
    this.used.clear();
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
    const word = normalizeWord(this.word);
    if (word.length === 0) return 'empty';
    if (word.length < MIN_WORD_LENGTH) return 'short';
    if (!this.dictionary?.has(word)) return 'unknown';
    if (this.used.has(word)) return 'used';
    return 'valid';
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
    const status = this.status();
    if (status !== 'valid') {
      return { ok: false, word, reason: status === 'empty' ? 'short' : status };
    }
    const items = this.picked;
    this.used.add(normalizeWord(word));
    this.picked = [];
    return { ok: true, word, items };
  }

  clear(): void {
    this.picked = [];
  }
}
