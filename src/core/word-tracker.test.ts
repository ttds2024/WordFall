import { describe, expect, it } from 'vitest';
import { Dictionary } from './dictionary';
import { WordTracker } from './word-tracker';

const dict = new Dictionary(['cat', 'cats', 'dog', 'zoo']);
const tiles = (word: string) => [...word].map((letter) => ({ letter }));

function typeWord(tracker: WordTracker<{ letter: string }>, word: string) {
  for (const tile of tiles(word)) tracker.add(tile);
}

describe('WordTracker', () => {
  it('builds a word and reports its status', () => {
    const tracker = new WordTracker(dict);
    expect(tracker.status()).toBe('empty');
    typeWord(tracker, 'CA');
    expect(tracker.word).toBe('CA');
    expect(tracker.status()).toBe('short');
    tracker.add({ letter: 'T' });
    expect(tracker.status()).toBe('valid');
    tracker.add({ letter: 'X' });
    expect(tracker.status()).toBe('unknown');
  });

  it('ignores the same tile twice', () => {
    const tracker = new WordTracker(dict);
    const tile = { letter: 'C' };
    expect(tracker.add(tile)).toBe(true);
    expect(tracker.add(tile)).toBe(false);
    expect(tracker.word).toBe('C');
  });

  it('submits on request', () => {
    const tracker = new WordTracker(dict);
    typeWord(tracker, 'DOG');
    const result = tracker.submit();
    expect(result).toMatchObject({ ok: true, word: 'DOG' });
    expect(tracker.word).toBe('');
  });

  it('keeps an invalid word so the player can fix it', () => {
    const tracker = new WordTracker(dict);
    typeWord(tracker, 'CAX');
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'unknown' });
    expect(tracker.word).toBe('CAX');
    tracker.clear();
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'short' });
  });

  it('rejects a word already found', () => {
    const tracker = new WordTracker(dict);
    typeWord(tracker, 'DOG');
    tracker.submit();
    typeWord(tracker, 'DOG');
    expect(tracker.status()).toBe('used');
    expect(tracker.submit()).toMatchObject({ ok: false, reason: 'used' });
  });

  it('treats every word as unknown until a dictionary is loaded', () => {
    const tracker = new WordTracker(undefined);
    typeWord(tracker, 'DOG');
    expect(tracker.status()).toBe('unknown');
  });
});

describe('WordTracker with jokers', () => {
  const words = new Dictionary(['cat', 'cot', 'cut', 'cats', 'dog']);

  it('fills a joker with a letter that makes a word', () => {
    const tracker = new WordTracker(words);
    typeWord(tracker, 'C★T');
    expect(tracker.status()).toBe('valid');
    expect(tracker.resolved).toBe('cat');
    expect(tracker.submit()).toMatchObject({ ok: true, word: 'CAT' });
  });

  it('picks a word not found yet, then reports used', () => {
    const tracker = new WordTracker(words);
    for (const expected of ['CAT', 'COT', 'CUT']) {
      typeWord(tracker, 'C★T');
      expect(tracker.submit()).toMatchObject({ ok: true, word: expected });
    }
    typeWord(tracker, 'C★T');
    expect(tracker.status()).toBe('used');
  });

  it('allows only one joker per word', () => {
    const tracker = new WordTracker(words);
    const second = { letter: '★' };
    typeWord(tracker, 'C★');
    expect(tracker.canAdd(second)).toBe(false);
    expect(tracker.add(second)).toBe(false);
    expect(tracker.word).toBe('C★');
    expect(tracker.canAdd({ letter: 'T' })).toBe(true);
    tracker.clear();
    expect(tracker.canAdd(second)).toBe(true);
  });

  it('rejects a joker word that matches nothing', () => {
    const tracker = new WordTracker(words);
    typeWord(tracker, 'X★Z');
    expect(tracker.status()).toBe('unknown');
    expect(tracker.resolved).toBeUndefined();
  });
});
