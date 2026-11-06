import { Room, type Client, type Delayed } from '@colyseus/core';
import { ROUND_MS } from '../../src/core/round.ts';
import type { Language } from '../../src/i18n/index.ts';
import { loadDictionary } from './dictionaries.ts';
import { Match, parseSubmission, type Verdict } from './match.ts';
import { Player, WordfallState, type Phase } from './state.ts';

/** Countdown between the room filling up and the round starting. */
export const COUNTDOWN_MS = 3000;
/** How long a dropped player's seat is kept during a round. */
export const RECONNECT_SECONDS = 20;
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
const MAX_NAME_LENGTH = 24;
/** Letters of a private room's code: no 0/O or 1/I, which are easy to mix up. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Options for creating (or matching) a room; `name` is per player, on joining. */
export interface WordfallOptions {
  lang?: Language;
  /** Players per round, MIN_SEATS…MAX_SEATS; quick match pairs rooms with the same number. */
  seats?: number;
  /** A room for friends: hidden from quick match, joined by its code (the room ID). */
  private?: boolean;
  name?: string;
}

/** Messages the server sends to one client or to the room. */
export interface ServerMessages {
  /** To the submitter: whether the word scored. */
  verdict: Verdict;
  /** To everyone: a player scored a word, which nobody can score again this round. */
  found: { sessionId: string; word: string; points: number };
}

function parseLang(value: unknown): Language {
  return value === 'en' ? 'en' : 'ru';
}

function parseSeats(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, MIN_SEATS), MAX_SEATS) : MIN_SEATS;
}

function parseName(value: unknown, fallback: string): string {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return [...name].slice(0, MAX_NAME_LENGTH).join('') || fallback;
}

function roomCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('');
}

/**
 * A WordFall match: 2–4 players, a shared 2-minute round. Each player plays on their own field;
 * the server keeps the clock, checks every word against the dictionary, scores it and makes
 * sure each word scores only once, for whoever found it first.
 */
export class WordfallRoom extends Room<{ state: WordfallState }> {
  state = new WordfallState();
  maxClients = MIN_SEATS;
  /** A client sending more is disconnected; tapping out words never comes close. */
  maxMessagesPerSecond = 20;

  /** Lengths of the countdown and the round; tests shorten them. */
  protected countdownMs = COUNTDOWN_MS;
  protected roundMs = ROUND_MS;

  private match!: Match;
  private timer: Delayed | undefined;

  async onCreate(options: WordfallOptions = {}): Promise<void> {
    const lang = parseLang(options.lang);
    const seats = parseSeats(options.seats);
    this.state.lang = lang;
    this.state.seats = seats;
    this.maxClients = seats;
    if (options.private) {
      this.roomId = roomCode();
      await this.setPrivate(true);
    }
    this.match = new Match(await loadDictionary(lang), lang);

    this.onMessage('submit', (client, message: unknown) => this.submit(client, message));
    this.onMessage('rematch', (client) => this.rematch(client));
  }

  onJoin(client: Client, options: WordfallOptions = {}): void {
    const player = new Player();
    player.name = parseName(options.name, `Player ${this.state.players.size + 1}`);
    this.state.players.set(client.sessionId, player);
    if (this.state.players.size === this.state.seats) void this.startCountdown();
  }

  async onDrop(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.inRound()) return;
    player.connected = false;
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
    } catch {
      // Not back in time: onLeave follows.
    }
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.state.phase === 'waiting') {
      this.state.players.delete(client.sessionId);
      return;
    }
    // Keep the score on the board, so the others still see who they played against.
    player.connected = false;
    if (this.state.phase === 'countdown' && this.connectedCount() < 2) this.setPhase('finished');
    else if (this.state.phase === 'finished') this.maybeRematch();
  }

  onDispose(): void {
    this.timer?.clear();
  }

  private inRound(): boolean {
    return this.state.phase === 'countdown' || this.state.phase === 'playing';
  }

  private connectedCount(): number {
    let n = 0;
    this.state.players.forEach((p) => (n += p.connected ? 1 : 0));
    return n;
  }

  private setPhase(phase: Phase): void {
    this.timer?.clear();
    this.timer = undefined;
    this.state.phase = phase;
  }

  /** Counts `ms` down in state.timeLeftMs, then calls `done`. */
  private countDown(ms: number, done: () => void): void {
    this.state.timeLeftMs = ms;
    const end = this.clock.currentTime + ms;
    this.timer = this.clock.setInterval(
      () => {
        const left = Math.max(0, end - this.clock.currentTime);
        this.state.timeLeftMs = Math.ceil(left / 1000) * 1000;
        if (left === 0) done();
      },
      Math.min(1000, ms),
    );
  }

  private async startCountdown(): Promise<void> {
    // Nobody joins a round in progress: the room stays closed until it is disposed.
    await this.lock();
    this.match.reset();
    this.state.players.forEach((p) => {
      p.score = 0;
      p.words = 0;
      p.rematch = false;
    });
    this.state.seed = Math.floor(Math.random() * 2 ** 32);
    this.setPhase('countdown');
    this.countDown(this.countdownMs, () => this.startRound());
  }

  private startRound(): void {
    this.setPhase('playing');
    this.countDown(this.roundMs, () => {
      this.state.timeLeftMs = 0;
      this.setPhase('finished');
    });
  }

  private submit(client: Client, message: unknown): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== 'playing') return;
    const submission = parseSubmission(message);
    const verdict: Verdict = submission
      ? this.match.submit(submission)
      : { ok: false, reason: 'invalid' };
    client.send('verdict', verdict);
    if (!verdict.ok) return;
    player.score += verdict.points;
    player.words += 1;
    this.broadcast('found', {
      sessionId: client.sessionId,
      word: verdict.word,
      points: verdict.points,
    });
  }

  private rematch(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== 'finished') return;
    player.rematch = true;
    this.maybeRematch();
  }

  /** Starts another round once every player still here asked for one (and there are two). */
  private maybeRematch(): void {
    let ready = 0;
    let waiting = 0;
    this.state.players.forEach((p) => {
      if (!p.connected) return;
      if (p.rematch) ready++;
      else waiting++;
    });
    if (ready < 2 || waiting > 0) return;
    // Players who left lose their seat.
    this.state.players.forEach((p, id) => {
      if (!p.connected) this.state.players.delete(id);
    });
    void this.startCountdown();
  }
}
