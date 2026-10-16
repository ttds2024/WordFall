import { describe, expect, it } from 'vitest';
import { loadProfile, savePending, saveProfile, takePending, type AuthStorage } from './store';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function storage(): AuthStorage {
  return {
    local: new MemoryStorage() as unknown as Storage,
    session: new MemoryStorage() as unknown as Storage,
  };
}

describe('auth storage', () => {
  it('keeps the profile until sign-out', () => {
    const s = storage();
    expect(loadProfile(s)).toBeUndefined();
    saveProfile(s, { provider: 'vk', name: 'Ivan', avatar: 'a.jpg' });
    expect(loadProfile(s)).toEqual({ provider: 'vk', name: 'Ivan', avatar: 'a.jpg' });
    saveProfile(s, undefined);
    expect(loadProfile(s)).toBeUndefined();
  });

  it('hands out a pending login only once', () => {
    const s = storage();
    savePending(s, { provider: 'vk', state: 's', codeVerifier: 'v' });
    expect(takePending(s)).toEqual({ provider: 'vk', state: 's', codeVerifier: 'v' });
    expect(takePending(s)).toBeUndefined();
  });

  it('ignores damaged data and missing storage', () => {
    const s = storage();
    s.local!.setItem('wordfall.profile', '{"provider":"sber","name":"X"}');
    expect(loadProfile(s)).toBeUndefined();
    s.local!.setItem('wordfall.profile', 'not json');
    expect(loadProfile(s)).toBeUndefined();
    expect(loadProfile({ local: undefined, session: undefined })).toBeUndefined();
  });
});
