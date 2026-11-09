import { describe, expect, it } from 'vitest';
import { normalizeCode, parseServerMessage, ROOM_CODE } from './protocol';

describe('parseServerMessage', () => {
  it('reads a message with a type', () => {
    expect(parseServerMessage('{"type":"room","code":"ABCD"}')).toEqual({
      type: 'room',
      code: 'ABCD',
    });
  });

  it('ignores anything else', () => {
    expect(parseServerMessage('not json')).toBeUndefined();
    expect(parseServerMessage('[1,2]')).toBeUndefined();
    expect(parseServerMessage('{"code":"ABCD"}')).toBeUndefined();
    expect(parseServerMessage('null')).toBeUndefined();
  });
});

describe('room codes', () => {
  it('are four letters without look-alikes', () => {
    expect(ROOM_CODE.test(normalizeCode(' abcd '))).toBe(true);
    expect(ROOM_CODE.test('ABC')).toBe(false);
    expect(ROOM_CODE.test('ABIO')).toBe(false);
    expect(ROOM_CODE.test('AB1D')).toBe(false);
  });
});
