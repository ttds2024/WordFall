/**
 * What the game and the multiplayer server (server/) say to each other. The server imports
 * these types too, so both sides agree.
 */

/** Room name on the server. */
export const ROOM_NAME = 'wordfall';

/** - waiting: the room is filling up; countdown: the round starts soon; then playing, finished. */
export type Phase = 'waiting' | 'countdown' | 'playing' | 'finished';

/** A word sent to the server: the letters in the order tapped (JOKER for a star) and ×2 tiles. */
export interface Submission {
  letters: string;
  doubles: number;
}

/** The server's answer to a submission, sent to the player who sent it. */
export type Verdict =
  | { ok: true; word: string; points: number }
  | { ok: false; reason: 'invalid' | 'short' | 'unknown' | 'used' };

/** Sent to everyone when a player scores a word, which nobody can score again this round. */
export interface Found {
  sessionId: string;
  word: string;
  points: number;
}
