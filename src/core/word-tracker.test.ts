import { describe, expect, it } from 'vitest';
import { Dictionary } from './dictionary';
import { AUTO_SUBMIT_DELAY_MS, WordTracker } from './word-tracker';

const dict = new Dictionary(['cat', 'cats', 'dog', 'zoo']);
const tiles = (word: string) => [...word].map((letter) => ({ letter }));

function typeWord(tracker: WordTracker<{ letter: string }>, word: string, start = 0) {
  let result;
  tiles(word).forEach((tile, i) => (result = tracker.add(tile, start + i * 100)));
  return result;
}

describe('WordTracker in button mode', () => {
  it('builds a word and reports its status', () => {
    const tracker = new WordTracker(dict, 'button');
    expect(tracker.status()).toBe('empty');
    typeWord(tracker, 'CA');
    expect(tracker.word).toBe('CA');
    expect(tracker.status()).toBe('short');
    tracker.add({ letter: 'T' }, 300);
    expect(tracker.status()).toBe('valid');
    tracker.add({ letter: 'X' }, 400);
    expect(tracker.status()).toBe('unknown');
  });

  it('ignores the same tile twice', () => {
    const tracker = new WordTracker(dict, 'button');
    const tile = { letter: 'C' };
    tracker.add(tile, 0);
    tracker.add(tile, 1);
    expect(tracker.word).toBe('C');
  });

  it('submits only on request, and never automatically', () => {
    const tracker = new WordTracker(dict, 'button');
    expect(typeWord(tracker, 'DOG')).toBeUndefined();
    expect(tracker.update(10_000)).toBeUndefined();
    const result = tracker.submit();
    expect(result).toMatchObject({ ok: true, word: 'DOG' });
    expect(tracker.word).toBe('');
  });

  it('keeps an invalid word so the player can fix it', () => {
    const tracker = new WordTracker(dict, 'button');
    typeWord(tracker, 'CAX');
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'unknown' });
    expect(tracker.word).toBe('CAX');
    tracker.clear();
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'short' });
  });

  it('rejects a word already found', () => {
    const tracker = new WordTracker(dict, 'button');
    typeWord(tracker, 'DOG');
    tracker.submit();
    typeWord(tracker, 'DOG');
    expect(tracker.status()).toBe('used');
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'used' });
  });

  it('treats every word as unknown until a dictionary is loaded', () => {
    const tracker = new WordTracker(undefined, 'button');
    typeWord(tracker, 'DOG');
    expect(tracker.status()).toBe('unknown');
  });
});

describe('WordTracker in auto mode', () => {
  it('submits at once when no longer word can follow', () => {
    const tracker = new WordTracker(dict, 'auto');
    expect(typeWord(tracker, 'DOG')).toMatchObject({ ok: true, word: 'DOG' });
  });

  it('waits when a longer word is possible, then submits after a pause', () => {
    const tracker = new WordTracker(dict, 'auto');
    expect(typeWord(tracker, 'CAT')).toBeUndefined();
    expect(tracker.update(200 + AUTO_SUBMIT_DELAY_MS - 1)).toBeUndefined();
    expect(tracker.update(200 + AUTO_SUBMIT_DELAY_MS)).toMatchObject({ ok: true, word: 'CAT' });
  });

  it('lets the player extend the word before the pause ends', () => {
    const tracker = new WordTracker(dict, 'auto');
    typeWord(tracker, 'CAT');
    expect(tracker.add({ letter: 'S' }, 1000)).toMatchObject({ ok: true, word: 'CATS' });
  });

  it('never submits an invalid word', () => {
    const tracker = new WordTracker(dict, 'auto');
    typeWord(tracker, 'CAX');
    expect(tracker.update(100_000)).toBeUndefined();
    expect(tracker.word).toBe('CAX');
  });
});

describe('WordTracker with jokers', () => {
  const words = new Dictionary(['cat', 'cot', 'cut', 'cats', 'dog']);

  it('fills a joker with a letter that makes a word', () => {
    const tracker = new WordTracker(words, 'button');
    typeWord(tracker, 'C★T');
    expect(tracker.status()).toBe('valid');
    expect(tracker.resolved).toBe('cat');
    expect(tracker.submit()).toMatchObject({ ok: true, word: 'CAT' });
  });

  it('picks a word not found yet, then reports used', () => {
    const tracker = new WordTracker(words, 'button');
    for (const expected of ['CAT', 'COT', 'CUT']) {
      typeWord(tracker, 'C★T');
      expect(tracker.submit()).toMatchObject({ ok: true, word: expected });
    }
    typeWord(tracker, 'C★T');
    expect(tracker.status()).toBe('used');
  });

  it('rejects a joker word that matches nothing', () => {
    const tracker = new WordTracker(words, 'button');
    typeWord(tracker, 'X★Z');
    expect(tracker.status()).toBe('unknown');
    expect(tracker.resolved).toBeUndefined();
  });

  it('waits in auto mode while a longer word could follow', () => {
    const tracker = new WordTracker(words, 'auto');
    expect(typeWord(tracker, 'C★T')).toBeUndefined();
    expect(typeWord(new WordTracker(words, 'auto'), 'D★G')).toMatchObject({
      ok: true,
      word: 'DOG',
    });
  });
});
