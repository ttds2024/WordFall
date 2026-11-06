import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from './app.ts';
import { WordfallRoom } from './room.ts';

/** The real room with a short countdown and round. */
class FastRoom extends WordfallRoom {
  protected countdownMs = 50;
  protected roundMs = 400;
}

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(createServer(FastRoom));
});
afterAll(() => colyseus.shutdown());
beforeEach(() => colyseus.cleanup());

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('WordfallRoom', () => {
  it('pairs two players, plays a round and scores each word once', async () => {
    const anna = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'ru', name: 'Анна' });
    const boris = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'ru', name: 'Борис' });
    expect(boris.roomId).toBe(anna.roomId);
    const room = colyseus.getRoomById<WordfallRoom['state']>(anna.roomId);

    await until(() => room.state.phase === 'playing');
    expect(room.state.seed).toBeGreaterThan(0);

    const found = anna.waitForMessage('found');
    anna.send('submit', { letters: 'КОТ', doubles: 1 });
    expect(await anna.waitForMessage('verdict')).toEqual({ ok: true, word: 'КОТ', points: 600 });
    expect(await found).toMatchObject({ sessionId: anna.sessionId, word: 'КОТ' });

    boris.send('submit', { letters: 'кот' });
    expect(await boris.waitForMessage('verdict')).toEqual({ ok: false, reason: 'used' });
    boris.send('submit', { letters: 'ткщ' });
    expect(await boris.waitForMessage('verdict')).toEqual({ ok: false, reason: 'unknown' });

    await until(() => room.state.phase === 'finished');
    expect(room.state.players.get(anna.sessionId)).toMatchObject({ name: 'Анна', score: 600 });
    expect(room.state.players.get(boris.sessionId)).toMatchObject({ name: 'Борис', score: 0 });

    // Words are not accepted once time is up.
    anna.send('submit', { letters: 'дом' });
    await room.waitForNextMessage();
    expect(room.state.players.get(anna.sessionId)!.score).toBe(600);

    // A rematch starts once both ask for it, with scores reset and a new seed.
    const seed = room.state.seed;
    anna.send('rematch');
    boris.send('rematch');
    await until(() => room.state.phase === 'countdown' || room.state.phase === 'playing');
    expect(room.state.players.get(anna.sessionId)!.score).toBe(0);
    expect(room.state.seed).not.toBe(seed);
  });

  it('keeps languages and room sizes apart', async () => {
    const ru = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'ru' });
    const en = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'en' });
    const three = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'ru', seats: 3 });
    expect(new Set([ru.roomId, en.roomId, three.roomId]).size).toBe(3);
  });

  it('hides private rooms from quick match and lets friends join by code', async () => {
    const host = await colyseus.sdk.create('wordfall', { lang: 'ru', private: true });
    expect(host.roomId).toMatch(/^[A-Z2-9]{6}$/);
    const stranger = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'ru' });
    expect(stranger.roomId).not.toBe(host.roomId);
    const friend = await colyseus.sdk.joinById(host.roomId, { name: 'Друг' });
    expect(friend.roomId).toBe(host.roomId);
  });

  it('frees the seat of a player who leaves before the round', async () => {
    const a = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'en', seats: 3 });
    const b = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'en', seats: 3 });
    const room = colyseus.getRoomById<WordfallRoom['state']>(a.roomId);
    await b.leave();
    await until(() => room.state.players.size === 1);
    const c = await colyseus.sdk.joinOrCreate('wordfall', { lang: 'en', seats: 3 });
    expect(c.roomId).toBe(a.roomId);
    expect(room.state.phase).toBe('waiting');
  });
});
