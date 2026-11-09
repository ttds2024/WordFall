/**
 * A match against a friend: two players, each on their own field, for the same 2 minutes, seeing
 * each other's score. One creates the match and gets a short code; the other joins with it.
 *
 * Nothing is stored. The two browsers talk over a channel named after the code (Supabase
 * Realtime broadcast, see connect()). Scores are whatever each browser says, which is fine
 * between friends; match rounds do not go on the leaderboard.
 *
 * The messages:
 *   join  {name}        a player with the code asks to play
 *   start {to, name}    the creator accepts the first one who asked: the round starts for both
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
  | { t: 'start'; from: string; to: string; name: string }
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
      return typeof m.to === 'string' ? { t: 'start', from, to: m.to, name } : undefined;
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

export interface MatchEvents {
  /** The other player is here: the round starts now. */
  onStart(opponentName: string): void;
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

  constructor(
    readonly code: string,
    readonly role: 'host' | 'guest',
    private readonly name: string,
    private readonly wire: Wire,
    private readonly events: MatchEvents,
    id: string = crypto.randomUUID(),
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
    this.wire.send({ t: 'join', from: this.id, name: this.name });
  }

  receive(message: Message): void {
    if (this.over || message.from === this.id) return;
    if (message.t === 'join') {
      if (this.role !== 'host') return;
      if (this.opponent === undefined) {
        this.opponent = message.from;
        this.wire.send({ t: 'start', from: this.id, to: message.from, name: this.name });
        this.events.onStart(message.name);
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
      this.events.onStart(message.name);
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
