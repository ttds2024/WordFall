import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JOIN_TIMEOUT_MS,
  Match,
  channelName,
  newCode,
  outcome,
  readCode,
  readMessage,
  type MatchEvents,
  type Message,
  type Wire,
} from './match';

/** A channel in memory: what one player sends, all the others receive. */
class Room {
  readonly players: Match[] = [];
  readonly sent: Message[] = [];

  join(role: 'host' | 'guest', name: string, id: string): { match: Match; events: MatchEvents } {
    const events: MatchEvents = {
      onStart: vi.fn(),
      onScore: vi.fn(),
      onFinal: vi.fn(),
      onLeft: vi.fn(),
      onError: vi.fn(),
    };
    const wire: Wire = {
      send: (message) => {
        this.sent.push(message);
        // Through JSON and readMessage, as over the real channel.
        const read = readMessage(JSON.parse(JSON.stringify(message)));
        for (const other of [...this.players]) if (other !== match && read) other.receive(read);
      },
      close: () => {
        this.players.splice(this.players.indexOf(match), 1);
      },
    };
    const match: Match = new Match('ABCDE', role, name, wire, events, id);
    this.players.push(match);
    match.open();
    return { match, events };
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a match', () => {
  it('starts for both when the second player joins, each learning the other name', () => {
    const room = new Room();
    const host = room.join('host', 'Ann', 'h');
    expect(host.match.started).toBe(false);
    const guest = room.join('guest', 'Bo', 'g');
    expect(host.events.onStart).toHaveBeenCalledWith('Bo');
    expect(guest.events.onStart).toHaveBeenCalledWith('Ann');
    expect(guest.match.started).toBe(true);
    vi.advanceTimersByTime(JOIN_TIMEOUT_MS * 2);
    expect(guest.events.onError).not.toHaveBeenCalled();
  });

  it('carries scores, the final score and leaving to the other player only', () => {
    const room = new Room();
    const host = room.join('host', 'Ann', 'h');
    const guest = room.join('guest', 'Bo', 'g');
    guest.match.sendScore(300);
    host.match.sendScore(500);
    guest.match.sendFinal(900);
    expect(host.events.onScore).toHaveBeenCalledWith(300);
    expect(guest.events.onScore).toHaveBeenCalledWith(500);
    expect(host.events.onFinal).toHaveBeenCalledWith(900);
    expect(guest.events.onFinal).not.toHaveBeenCalled();
    host.match.leave();
    expect(guest.events.onLeft).toHaveBeenCalledOnce();
    // Having left, it hears and says nothing more.
    guest.match.sendScore(1200);
    host.match.sendScore(9999);
    expect(host.events.onScore).toHaveBeenCalledTimes(1);
    expect(guest.events.onScore).toHaveBeenCalledTimes(1);
  });

  it('gives up when nobody answers the code', () => {
    const room = new Room();
    const guest = room.join('guest', 'Bo', 'g');
    vi.advanceTimersByTime(JOIN_TIMEOUT_MS - 1);
    expect(guest.events.onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(guest.events.onError).toHaveBeenCalledWith('notFound');
    expect(room.players).toEqual([]);
  });

  it('refuses a third player, whose messages do not count', () => {
    const room = new Room();
    const host = room.join('host', 'Ann', 'h');
    const guest = room.join('guest', 'Bo', 'g');
    const third = room.join('guest', 'Cy', 'x');
    expect(third.events.onError).toHaveBeenCalledWith('full');
    expect(third.events.onStart).not.toHaveBeenCalled();
    expect(host.events.onStart).toHaveBeenCalledTimes(1);
    host.match.receive({ t: 'score', from: 'x', score: 99999 });
    guest.match.receive({ t: 'left', from: 'x' });
    expect(host.events.onScore).not.toHaveBeenCalled();
    expect(guest.events.onLeft).not.toHaveBeenCalled();
  });

  it('says nothing before the round has started, and leaves a waiting match quietly', () => {
    const room = new Room();
    const host = room.join('host', 'Ann', 'h');
    host.match.sendScore(100);
    host.match.leave();
    expect(room.sent).toEqual([]);
    expect(room.players).toEqual([]);
  });

  it('reports a connection that failed, once', () => {
    const room = new Room();
    const host = room.join('host', 'Ann', 'h');
    host.match.fail('failed');
    host.match.fail('failed');
    expect(host.events.onError).toHaveBeenCalledTimes(1);
  });
});

describe('codes', () => {
  it('makes 5-character codes without look-alike characters', () => {
    expect(newCode(() => 0)).toBe('AAAAA');
    expect(newCode(() => 0.999)).toBe('99999');
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });

  it('reads a typed code whatever its case and spacing', () => {
    expect(readCode(' ab-cd e ')).toBe('ABCDE');
    expect(readCode('abcd')).toBeUndefined();
    expect(readCode('abcdef')).toBeUndefined();
    expect(readCode('ab0de')).toBeUndefined();
  });

  it('names the channel after the code', () => {
    expect(channelName('ABCDE')).toBe('wordfall-match-ABCDE');
  });
});

describe('readMessage', () => {
  it('reads the messages of a match', () => {
    expect(readMessage({ t: 'join', from: 'g', name: 'Bo' })).toEqual({
      t: 'join',
      from: 'g',
      name: 'Bo',
    });
    expect(readMessage({ t: 'final', from: 'g', score: 900.7 })).toEqual({
      t: 'final',
      from: 'g',
      score: 900,
    });
    expect(readMessage({ t: 'left', from: 'g' })).toEqual({ t: 'left', from: 'g' });
  });

  it('cuts long names and ignores anything else', () => {
    expect(readMessage({ t: 'join', from: 'g', name: 'x'.repeat(100) })).toMatchObject({
      name: 'x'.repeat(24),
    });
    expect(readMessage(null)).toBeUndefined();
    expect(readMessage({ t: 'score', from: 'g', score: -5 })).toBeUndefined();
    expect(readMessage({ t: 'score', from: 'g', score: 'lots' })).toBeUndefined();
    expect(readMessage({ t: 'start', from: 'h' })).toBeUndefined();
    expect(readMessage({ t: 'join', name: 'Bo' })).toBeUndefined();
    expect(readMessage({ t: 'dance', from: 'g' })).toBeUndefined();
  });
});

describe('outcome', () => {
  it('says who won', () => {
    expect(outcome(900, 300)).toBe('win');
    expect(outcome(300, 900)).toBe('loss');
    expect(outcome(300, 300)).toBe('draw');
  });
});
