import { normalizeWord } from './word';

/** How often the bot's word is right. */
export const BOT_ACCURACY = 0.5;
/** The bot tries a word every 6 to 10 seconds of play. */
export const BOT_MIN_MS = 6000;
export const BOT_MAX_MS = 10000;
/** How long the bot's picked letters stay highlighted before its word is checked. */
export const BOT_THINK_MS = 900;
/** Word lengths the bot goes for. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 6;

type Random = () => number;

/** Counts play time and says when the bot should try its next word. */
export class BotClock {
  private wait: number;

  constructor(private readonly random: Random = Math.random) {
    this.wait = this.next();
  }

  /** Advances play time; true when it is time for the bot's next try. */
  advance(ms: number): boolean {
    this.wait -= ms;
    if (this.wait > 0) return false;
    this.wait = this.next();
    return true;
  }

  private next(): number {
    return BOT_MIN_MS + this.random() * (BOT_MAX_MS - BOT_MIN_MS);
  }
}

/**
 * Picks a word the bot can spell from these letters: a random dictionary word of 3 to 6 letters
 * not found yet. Returns the indexes of the letters it uses, in word order, or undefined.
 */
export function findWord(
  letters: readonly string[],
  words: readonly string[],
  isUsed: (word: string) => boolean,
  random: Random = Math.random,
): number[] | undefined {
  const normal = letters.map(normalizeWord);
  const counts = new Map<string, number>();
  for (const letter of normal) counts.set(letter, (counts.get(letter) ?? 0) + 1);

  // Reservoir sampling: a uniformly random fitting word in one pass.
  let chosen: string | undefined;
  let seen = 0;
  for (const word of words) {
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue;
    if (!fits(word, counts) || isUsed(word)) continue;
    seen++;
    if (random() * seen < 1) chosen = word;
  }
  if (!chosen) return undefined;

  const taken = new Set<number>();
  return [...chosen].map((letter) => {
    const index = normal.findIndex((l, i) => l === letter && !taken.has(i));
    taken.add(index);
    return index;
  });
}

function fits(word: string, counts: ReadonlyMap<string, number>): boolean {
  const need = new Map<string, number>();
  for (const letter of word) {
    const n = (need.get(letter) ?? 0) + 1;
    if (n > (counts.get(letter) ?? 0)) return false;
    need.set(letter, n);
  }
  return true;
}

/**
 * Picks 3 or 4 random letters that do not spell a word: the bot's wrong guess. Returns their
 * indexes, or undefined if there are too few letters or every try spelled a word.
 */
export function pickMiss(
  letters: readonly string[],
  isWord: (word: string) => boolean,
  random: Random = Math.random,
): number[] | undefined {
  const length = random() < 0.5 ? 3 : 4;
  if (letters.length < length) return undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    const indexes = shuffle(
      letters.map((_, i) => i),
      random,
    ).slice(0, length);
    if (!isWord(indexes.map((i) => letters[i]).join(''))) return indexes;
  }
  return undefined;
}

function shuffle<T>(items: T[], random: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
