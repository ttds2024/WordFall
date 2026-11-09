import { describe, expect, it } from 'vitest';
import { cleanName, defaultName, loadGuest, saveGuest } from './guest';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size;
    },
  };
}

describe('guest', () => {
  it('makes a guest with a long random token once, and remembers it', () => {
    const storage = memoryStorage();
    const first = loadGuest(storage, () => 'Guest 1234');
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.name).toBe('Guest 1234');
    expect(loadGuest(storage, () => 'Guest 9999')).toEqual(first);
    expect(loadGuest(memoryStorage(), () => 'x').token).not.toBe(first.token);
  });

  it('keeps a changed name', () => {
    const storage = memoryStorage();
    const guest = loadGuest(storage, () => 'Guest 1234');
    saveGuest(storage, { ...guest, name: 'Ann' });
    expect(loadGuest(storage, () => 'x')).toEqual({ token: guest.token, name: 'Ann' });
  });

  it('starts again when what was saved is not a guest', () => {
    const storage = memoryStorage();
    storage.setItem('wordfall.guest', '{"token":"short","name":"Ann"}');
    expect(loadGuest(storage, () => 'Guest 1').token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    storage.setItem('wordfall.guest', 'not json');
    expect(loadGuest(storage, () => 'Guest 1').name).toBe('Guest 1');
  });

  it('works without storage, for this visit only', () => {
    expect(loadGuest(undefined, () => 'Guest 1').token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('names', () => {
  it('keeps a name to one line of at most 24 characters', () => {
    expect(cleanName('  Ann \n Lee  ')).toBe('Ann Lee');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
    expect(cleanName('   ')).toBe('');
  });

  it('calls a new guest "Guest" and four digits', () => {
    expect(defaultName('Guest', () => 0)).toBe('Guest 1000');
    expect(defaultName('Гость', () => 0.99999)).toBe('Гость 9999');
  });
});
