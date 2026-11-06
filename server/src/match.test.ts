import { describe, expect, it } from 'vitest';
import { Dictionary } from '../../src/core/dictionary.ts';
import { Match, parseSubmission } from './match.ts';

const dict = new Dictionary(['кот', 'кит', 'код', 'дом', 'слово']);

describe('Match', () => {
  it('scores a word 100 per letter, once per round', () => {
    const match = new Match(dict, 'ru');
    expect(match.submit({ letters: 'КОТ', doubles: 0 })).toEqual({
      ok: true,
      word: 'КОТ',
      points: 300,
    });
    expect(match.submit({ letters: 'кот', doubles: 0 })).toEqual({ ok: false, reason: 'used' });
    match.reset();
    expect(match.submit({ letters: 'кот', doubles: 0 }).ok).toBe(true);
  });

  it('multiplies by 2 per ×2 tile, as the game does', () => {
    const match = new Match(dict, 'ru');
    expect(match.submit({ letters: 'слово', doubles: 1 })).toMatchObject({ points: 1000 });
    expect(match.submit({ letters: 'дом', doubles: 2 })).toMatchObject({ points: 1200 });
  });

  it('lets a star stand for the first match not found yet', () => {
    const match = new Match(dict, 'ru');
    expect(match.submit({ letters: 'К★Т', doubles: 0 })).toMatchObject({ word: 'КИТ' });
    expect(match.submit({ letters: 'К★Т', doubles: 0 })).toMatchObject({ word: 'КОТ' });
    expect(match.submit({ letters: 'К★Т', doubles: 0 })).toEqual({ ok: false, reason: 'used' });
  });

  it('refuses unknown, short and impossible words', () => {
    const match = new Match(dict, 'ru');
    expect(match.submit({ letters: 'ток', doubles: 0 })).toEqual({ ok: false, reason: 'unknown' });
    expect(match.submit({ letters: 'ко', doubles: 0 })).toEqual({ ok: false, reason: 'short' });
    expect(match.submit({ letters: 'cat', doubles: 0 })).toEqual({ ok: false, reason: 'invalid' });
    expect(match.submit({ letters: '★★т', doubles: 0 })).toEqual({ ok: false, reason: 'invalid' });
    // More ×2 tiles than letters (a star cannot be ×2).
    expect(match.submit({ letters: 'к★т', doubles: 3 })).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('parseSubmission', () => {
  it('accepts letters with an optional number of doubles', () => {
    expect(parseSubmission({ letters: 'кот' })).toEqual({ letters: 'кот', doubles: 0 });
    expect(parseSubmission({ letters: 'кот', doubles: 1 })).toEqual({ letters: 'кот', doubles: 1 });
  });

  it('rejects anything else', () => {
    expect(parseSubmission('кот')).toBeUndefined();
    expect(parseSubmission(null)).toBeUndefined();
    expect(parseSubmission({ letters: 5 })).toBeUndefined();
    expect(parseSubmission({ letters: 'кот', doubles: -1 })).toBeUndefined();
    expect(parseSubmission({ letters: 'кот', doubles: 1.5 })).toBeUndefined();
    expect(parseSubmission({ letters: 'а'.repeat(100) })).toBeUndefined();
  });
});
