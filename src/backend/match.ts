/**
 * A match against a friend: two players, each on their own field with the same letters falling,
 * for the same 2 minutes, seeing each other's score. One creates the match and gets a short code; the other joins with it.
 *
 * Nothing is stored. The two browsers talk over a channel named after the code (Supabase
 * Realtime broadcast, see connect()). Scores are whatever each browser says, which is fine
 * between friends; match rounds do not go on the leaderboard.
 *
 * The messages:
 *   join  {name}        a player with the code asks to play
 *   start {to, name, seed}  the creator accepts the first one who asked: the round starts for
 *                       both, with the letters this seed gives
 *   full  {to}          the creator refuses anyone after that
 *   score {score}       a player's score changed
 *   final {score}       a player's time ran out
 *   left                a player quit
 */

/** Letters and digits that are hard to mix up when read aloud or typed (no I, O, 0, 1). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
/** How long a joiner waits for the creator's answer before giving up. */
export const JOIN_TIMEOUT_MS = 6000;
/**
 * How long after accepting the joiner the creator's round starts. The joiner hears of it half a
 * round trip later and waits that much less, so both rounds start at the same moment.
 */
export const START_LEAD_MS = 1000;

export function newCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** What the player typed, as a code: upper case, only the code's letters; undefined if not one. */
export function readCode(input: string): string | undefined {
  const code = [...input.toUpperCase()].filter((c) => ALPHABET.includes(c)).join('');
  return code.length === CODE_LENGTH ? code : undefined;
}

export function channelName(code: string): string {
  return `wordfall-match-${code}`;
}

export type Message =
  | { t: 'join'; from: string; name: string }
  | { t: 'start'; from: string; to: string; name: string; seed: number }
  | { t: 'full'; from: string; to: string }
  | { t: 'score' | 'final'; from: string; score: number }
  | { t: 'left'; from: string };

const MAX_NAME = 24;

/** Reads a message off the channel; anything else on it is ignored. */
export function readMessage(data: unknown): Message | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const m = data as Record<string, unknown>;
  if (typeof m.from !== 'string' || !m.from) return undefined;
  const from = m.from;
  const name = typeof m.name === 'string' ? m.name.slice(0, MAX_NAME) : '';
  switch (m.t) {
    case 'join':
      return { t: 'join', from, name };
    case 'start':
      return typeof m.to === 'string'
        ? { t: 'start', from, to: m.to, name, seed: typeof m.seed === 'number' ? m.seed >>> 0 : 0 }
        : undefined;
    case 'full':
      return typeof m.to === 'string' ? { t: 'full', from, to: m.to } : undefined;
    case 'score':
    case 'final':
      return typeof m.score === 'number' && Number.isFinite(m.score) && m.score >= 0
        ? { t: m.t, from, score: Math.floor(m.score) }
        : undefined;
    case 'left':
      return { t: 'left', from };
    default:
      return undefined;
  }
}

/** The channel as a match sees it: send to everyone else on it, and stop. */
export interface Wire {
  send(message: Message): void;
  close(): void;
}

export type MatchError = 'notFound' | 'full' | 'failed';

/** How the round starts: the same for both players. */
export interface MatchStart {
  /** Seeds the falling letters. */
  seed: number;
  /** Milliseconds from now until the round starts. */
  delay: number;
}

export interface MatchEvents {
  /** The other player is here: the round starts in start.delay ms. */
  onStart(opponentName: string, start: MatchStart): void;
  onScore(score: number): void;
  /** The other player's time ran out, with this score. */
  onFinal(score: number): void;
  onLeft(): void;
  /** The match could not begin; it is over. */
  onError(error: MatchError): void;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * One player's side of a match. Give it a wire, pass it every message that arrives with
 * receive(), and call open() once the wire is connected.
 */
export class Match {
  /** This player on the channel. */
  readonly id: string;
  private opponent: string | undefined;
  private timer: Timer | undefined;
  private over = false;
  /** When the joiner asked to play, to time the creator's answer. */
  private askedAt = 0;

  constructor(
    readonly code: string,
    readonly role: 'host' | 'guest',
    private readonly name: string,
    private readonly wire: Wire,
    private readonly events: MatchEvents,
    id: string = crypto.randomUUID(),
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {
    this.id = id;
  }

  /** Whether the round has started (the other player is known). */
  get started(): boolean {
    return this.opponent !== undefined;
  }

  /** The wire is connected: the creator waits; the joiner asks to play, for JOIN_TIMEOUT_MS. */
  open(): void {
    if (this.over || this.role === 'host') return;
    this.timer = setTimeout(() => this.fail('notFound'), JOIN_TIMEOUT_MS);
    this.askedAt = this.now();
    this.wire.send({ t: 'join', from: this.id, name: this.name });
  }

  receive(message: Message): void {
    if (this.over || message.from === this.id) return;
    if (message.t === 'join') {
      if (this.role !== 'host') return;
      if (this.opponent === undefined) {
        this.opponent = message.from;
        const seed = Math.floor(this.random() * 2 ** 32) >>> 0;
        this.wire.send({ t: 'start', from: this.id, to: message.from, name: this.name, seed });
        this.events.onStart(message.name, { seed, delay: START_LEAD_MS });
      } else if (message.from !== this.opponent) {
        this.wire.send({ t: 'full', from: this.id, to: message.from });
      }
      return;
    }
    if (message.t === 'start' || message.t === 'full') {
      if (this.role !== 'guest' || this.opponent !== undefined || message.to !== this.id) return;
      clearTimeout(this.timer);
      if (message.t === 'full') {
        this.fail('full');
        return;
      }
      this.opponent = message.from;
      // The creator answered about half a round trip ago, and starts START_LEAD_MS after that.
      const delay = Math.max(0, START_LEAD_MS - (this.now() - this.askedAt) / 2);
      this.events.onStart(message.name, { seed: message.seed, delay });
      return;
    }
    // The rest counts only from the player this match is against.
    if (message.from !== this.opponent) return;
    if (message.t === 'score') this.events.onScore(message.score);
    else if (message.t === 'final') this.events.onFinal(message.score);
    else this.events.onLeft();
  }

  sendScore(score: number): void {
    if (!this.over && this.started) this.wire.send({ t: 'score', from: this.id, score });
  }

  sendFinal(score: number): void {
    if (!this.over && this.started) this.wire.send({ t: 'final', from: this.id, score });
  }

  /** The connection could not be made, or broke before the round started. */
  fail(error: MatchError): void {
    if (this.over) return;
    this.close();
    this.events.onError(error);
  }

  /** Quits: tells the other player (once the round has started) and hangs up. */
  leave(): void {
    if (this.over) return;
    if (this.started) this.wire.send({ t: 'left', from: this.id });
    this.close();
  }

  /** Hangs up without a word, once the match is finished. */
  close(): void {
    if (this.over) return;
    this.over = true;
    clearTimeout(this.timer);
    this.wire.close();
  }
}

/** How a finished match went for this player. */
export function outcome(mine: number, theirs: number): 'win' | 'loss' | 'draw' {
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}
