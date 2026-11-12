import type { Language } from '../i18n';

/**
 * Messages between the game and the multiplayer server (server/WordFall.Server), as JSON text
 * frames over one WebSocket. Tiles are named by their number in the round (Tile.seq); `null` in
 * a word's tiles is a star from the player's stock.
 */
export type ClientMessage =
  /** Play the next player who asks for the same language. */
  | { type: 'quick'; lang: Language; name: string }
  /** Open a private room; the server answers with its code. */
  | { type: 'create'; lang: Language; name: string }
  /** Join a private room by its code. */
  | { type: 'join'; code: string; lang: Language; name: string }
  /** The tiles in the word being built, shown to the other player. */
  | { type: 'pick'; tiles: number[] }
  /** Take a star from the field into the stock. */
  | { type: 'star'; tile: number }
  /** Magic hat number `hat` touched a tile on this field and changed these tiles' letters. */
  | { type: 'hat'; hat: number; tiles: number[] }
  /** Claim a word: `word` is the dictionary word it spells (a star filled in). */
  | { type: 'word'; id: number; tiles: (number | null)[]; word: string }
  | { type: 'leave' };

export type Side = 'you' | 'opponent';

export type ServerMessage =
  /** In the quick-match queue. */
  | { type: 'waiting' }
  /** A private room is open; the other player joins with this code. */
  | { type: 'room'; code: string }
  /** The round starts now. */
  | {
      type: 'start';
      seed: number;
      lang: Language;
      durationMs: number;
      opponent: string;
      stars: number;
    }
  /** The other player's word being built. */
  | { type: 'pick'; tiles: number[] }
  /** Someone took a star; `stars` is your stock. */
  | { type: 'star'; by: Side; tile: number; stars: number }
  /** The other player's magic hat changed these tiles' letters (each to its next one). */
  | { type: 'hat'; tiles: number[] }
  /** Someone scored a word. `id` echoes your claim when it was yours. */
  | {
      type: 'claimed';
      by: Side;
      id?: number;
      word: string;
      tiles: number[];
      points: number;
      you: number;
      opponent: number;
      stars: number;
    }
  /** Your claim (a word, or a star when `id` is absent) was refused. */
  | { type: 'rejected'; id?: number; reason: RejectReason }
  /** The round is over. */
  | { type: 'end'; you: number; opponent: number; reason: 'time' | 'left' }
  | { type: 'error'; reason: ErrorReason };

/** taken: the other player got there first; used: already found; full: 3 stars already. */
export type RejectReason = 'taken' | 'used' | 'invalid' | 'full';
/** noRoom: no open room with that code; language: the room plays another language. */
export type ErrorReason = 'noRoom' | 'language' | 'badRequest';

/** Codes of private rooms: 4 letters, without look-alikes (no I, L, O). */
export const ROOM_CODE = /^[A-HJKMNP-Z]{4}$/;

/** Upper-cases and trims a typed room code. */
export function normalizeCode(text: string): string {
  return text.trim().toUpperCase();
}

/** Parses a server frame; undefined for anything that is not a message object with a type. */
export function parseServerMessage(text: string): ServerMessage | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { type?: unknown }).type === 'string'
    ) {
      return value as ServerMessage;
    }
  } catch {
    // Not JSON.
  }
  return undefined;
}
