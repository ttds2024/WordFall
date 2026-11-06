import type { Dictionary } from '../../src/core/dictionary.ts';
import { scoreWord, wordMultiplier } from '../../src/core/scoring.ts';
import { JOKER, MIN_WORD_LENGTH, normalizeWord } from '../../src/core/word.ts';
import type { Language } from '../../src/i18n/index.ts';
import type { Submission, Verdict } from '../../src/online/protocol.ts';

export type { Submission, Verdict };

/** Longest word a client may submit; longer submissions are refused unread. */
export const MAX_WORD_LENGTH = 24;

const LETTERS: Record<Language, RegExp> = {
  en: /^[a-z★]+$/,
  ru: /^[а-я★]+$/,
};

/** Reads a client message into a Submission, or undefined if it is not one. */
export function parseSubmission(message: unknown): Submission | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const { letters, doubles } = message as Record<string, unknown>;
  if (typeof letters !== 'string' || letters.length > MAX_WORD_LENGTH) return undefined;
  const d = doubles ?? 0;
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 0) return undefined;
  return { letters, doubles: d };
}

/**
 * The words of one round, shared by everyone in the room, as against the bot: a word scores
 * once, for whoever submits it first. Scoring is the game's own (src/core/scoring.ts).
 */
export class Match {
  private readonly used = new Set<string>();

  constructor(
    private readonly dictionary: Dictionary,
    private readonly lang: Language,
  ) {}

  /** How many words have been found this round. */
  get found(): number {
    return this.used.size;
  }

  reset(): void {
    this.used.clear();
  }

  /**
   * Checks a word and, if it scores, records it. A star stands for any letter: the word it
   * spells is the first dictionary match not found yet, as in the game (WordTracker).
   */
  submit({ letters, doubles }: Submission): Verdict {
    const word = normalizeWord(letters);
    const jokers = [...word].filter((c) => c === JOKER).length;
    const plain = [...word].length - jokers;
    if (!LETTERS[this.lang].test(word) || jokers > 1 || doubles > plain) {
      return { ok: false, reason: 'invalid' };
    }
    if ([...word].length < MIN_WORD_LENGTH) return { ok: false, reason: 'short' };

    let reason: 'unknown' | 'used' = 'unknown';
    for (const match of this.dictionary.matches(word)) {
      if (this.used.has(match)) {
        reason = 'used';
        continue;
      }
      this.used.add(match);
      const tiles = Array.from({ length: doubles }, () => ({ kind: 'double' }));
      return {
        ok: true,
        word: match.toUpperCase(),
        points: scoreWord(match) * wordMultiplier(tiles),
      };
    }
    return { ok: false, reason };
  }
}
