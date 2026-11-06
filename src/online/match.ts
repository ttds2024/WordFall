import type { Room } from '@colyseus/sdk';
import type { Language } from '../i18n';
import { ROOM_NAME, type Found, type Phase, type Verdict } from './protocol';

/** The server's address (ws:// or wss://) from the build; unset hides online play. */
export const SERVER_URL: string | undefined = import.meta.env.VITE_MULTIPLAYER_URL || undefined;

/** The room's synced state, as far as the game reads it (see server/src/state.ts). */
interface RemotePlayer {
  name: string;
  score: number;
  connected: boolean;
}
interface RemoteState {
  phase: Phase;
  seed: number;
  timeLeftMs: number;
  players: { forEach(cb: (player: RemotePlayer, sessionId: string) => void): void };
}

export interface Rival {
  name: string;
  score: number;
  connected: boolean;
}

/** What the game shows of a match: the phase, the clock, the seed and both scores. */
export interface MatchView {
  phase: Phase;
  timeLeftMs: number;
  seed: number;
  score: number;
  /** The other player, once someone has joined. */
  rival: Rival | undefined;
}

export interface MatchEvents {
  /** The room's state changed. */
  onUpdate(view: MatchView): void;
  /** The server's answer to this player's last word. */
  onVerdict(verdict: Verdict): void;
  /** The rival scored a word. */
  onRivalWord(word: string, points: number): void;
  /** The connection is gone for good (the SDK reconnects on its own first). */
  onClosed(): void;
}

/** Why joining failed: no room with that code, it is full or playing, or no connection. */
export type JoinError = 'notFound' | 'unavailable';

/** Matchmaking error codes from Colyseus (ErrorCode in @colyseus/shared-types). */
const INVALID_ROOM_ID = 522;

export class JoinFailed extends Error {
  constructor(readonly reason: JoinError) {
    super(reason);
  }
}

/** How to get into a room: quick match, a new private room, or a friend's room by its code. */
export type JoinRequest = { kind: 'quick' } | { kind: 'create' } | { kind: 'join'; code: string };

/** A two-player match on the server. */
export class OnlineMatch {
  private closed = false;

  private constructor(
    private readonly room: Room,
    events: MatchEvents,
  ) {
    room.onStateChange(() => events.onUpdate(this.view()));
    room.onMessage('verdict', (verdict: Verdict) => events.onVerdict(verdict));
    room.onMessage('found', (found: Found) => {
      if (found.sessionId !== room.sessionId) events.onRivalWord(found.word, found.points);
    });
    room.onLeave(() => {
      if (this.closed) return;
      this.closed = true;
      events.onClosed();
    });
  }

  static async join(
    request: JoinRequest,
    options: { url: string; lang: Language; name: string },
    events: MatchEvents,
  ): Promise<OnlineMatch> {
    const { lang, name } = options;
    try {
      // The SDK is loaded only when someone plays online.
      const { Client } = await import('@colyseus/sdk');
      const client = new Client(options.url);
      const room =
        request.kind === 'quick'
          ? await client.joinOrCreate(ROOM_NAME, { lang, seats: 2, name })
          : request.kind === 'create'
            ? await client.create(ROOM_NAME, { lang, seats: 2, private: true, name })
            : await client.joinById(request.code, { name });
      return new OnlineMatch(room, events);
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      throw new JoinFailed(code === INVALID_ROOM_ID ? 'notFound' : 'unavailable');
    }
  }

  /** The code friends join with (the room ID). */
  get code(): string {
    return this.room.roomId;
  }

  view(): MatchView {
    const state = this.room.state as RemoteState;
    let score = 0;
    let rival: Rival | undefined;
    state.players?.forEach((player, sessionId) => {
      if (sessionId === this.room.sessionId) score = player.score;
      else rival ??= { name: player.name, score: player.score, connected: player.connected };
    });
    return {
      phase: state.phase ?? 'waiting',
      timeLeftMs: state.timeLeftMs ?? 0,
      seed: state.seed ?? 0,
      score,
      rival,
    };
  }

  submit(letters: string, doubles: number): void {
    this.room.send('submit', { letters, doubles });
  }

  rematch(): void {
    this.room.send('rematch');
  }

  leave(): void {
    if (this.closed) return;
    this.closed = true;
    void this.room.leave();
  }
}
