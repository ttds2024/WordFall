import { describe, expect, it } from 'vitest';
import { readBoard, roundArgs } from './rounds';

describe('roundArgs', () => {
  it('sends the words and multipliers, not the score', () => {
    expect(
      roundArgs({
        kind: 'solo',
        lang: 'en',
        words: [
          { word: 'CAT', multiplier: 1 },
          { word: 'HOUSE', multiplier: 4 },
        ],
        botScore: 0,
      }),
    ).toEqual({
      p_kind: 'solo',
      p_lang: 'en',
      p_words: [
        { w: 'cat', m: 1 },
        { w: 'house', m: 4 },
      ],
      p_bot_score: null,
    });
  });

  it("sends the bot's score in a round against it", () => {
    const args = roundArgs({ kind: 'bot', lang: 'ru', words: [], botScore: 700 });
    expect(args.p_bot_score).toBe(700);
    expect(roundArgs({ kind: 'bot', lang: 'ru', words: [] }).p_bot_score).toBe(0);
  });

  it('folds Ё into Е, as the word list does', () => {
    const args = roundArgs({ kind: 'solo', lang: 'ru', words: [{ word: 'ЁЛКА', multiplier: 1 }] });
    expect(args.p_words).toEqual([{ w: 'елка', m: 1 }]);
  });
});

describe('readBoard', () => {
  it('reads rows, marking the signed-in player', () => {
    expect(
      readBoard([
        { rank: 1, name: 'Ann', avatar: 'https://a/1.png', score: 2400, is_me: false },
        { rank: 2, name: 'Ivan', avatar: null, score: 900, is_me: true },
      ]),
    ).toEqual([
      { rank: 1, name: 'Ann', avatar: 'https://a/1.png', score: 2400, me: false },
      { rank: 2, name: 'Ivan', avatar: undefined, score: 900, me: true },
    ]);
  });

  it('shows only https pictures and skips anything that is not a row', () => {
    expect(
      readBoard([
        null,
        { name: 'Ann' },
        { rank: 1, name: 'Bo', avatar: 'javascript:x', score: 300 },
      ]),
    ).toEqual([{ rank: 1, name: 'Bo', avatar: undefined, score: 300, me: false }]);
    expect(readBoard(undefined)).toEqual([]);
    expect(readBoard({ error: 'x' })).toEqual([]);
  });
});
