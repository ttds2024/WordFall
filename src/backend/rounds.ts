import type { RoundKind } from '../core/round';
import { normalizeWord } from '../core/word';
import type { Language } from '../i18n';

/** A word the player scored, with its multiplier (1, or 2 for each ×2 tile in it). */
export interface FoundWord {
  word: string;
  multiplier: number;
}

/** A finished round, as the game knows it. */
export interface RoundReport {
  kind: RoundKind;
  lang: Language;
  words: readonly FoundWord[];
  /** The bot's score, in a round against it. */
  botScore?: number;
}

/**
 * The arguments of the database's submit_round(). The score is not sent: the database works it
 * out from the words, so a made-up total cannot be saved.
 */
export function roundArgs(report: RoundReport): {
  p_kind: RoundKind;
  p_lang: Language;
  p_words: { w: string; m: number }[];
  p_bot_score: number | null;
} {
  return {
    p_kind: report.kind,
    p_lang: report.lang,
    p_words: report.words.map(({ word, multiplier }) => ({
      w: normalizeWord(word),
      m: multiplier,
    })),
    p_bot_score: report.kind === 'bot' ? (report.botScore ?? 0) : null,
  };
}

/** One line of the leaderboard: a player's best score. */
export interface BoardRow {
  rank: number;
  name: string;
  avatar?: string;
  score: number;
  /** Whether this is the signed-in player. */
  me: boolean;
}

/** Reads the rows leaderboard() returned, dropping anything that is not a row. */
export function readBoard(data: unknown): BoardRow[] {
  if (!Array.isArray(data)) return [];
  const rows: BoardRow[] = [];
  for (const item of data as Record<string, unknown>[]) {
    if (!item || typeof item.name !== 'string' || typeof item.score !== 'number') continue;
    rows.push({
      rank: Number(item.rank) || rows.length + 1,
      name: item.name,
      // Only https pictures are shown.
      avatar:
        typeof item.avatar === 'string' && item.avatar.startsWith('https://')
          ? item.avatar
          : undefined,
      score: item.score,
      me: item.is_me === true,
    });
  }
  return rows;
}
