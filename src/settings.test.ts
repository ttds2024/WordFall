import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings, type Settings } from './settings';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const defaults: Settings = { lang: 'en' };

describe('settings', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    saveSettings({ lang: 'ru' }, storage);
    expect(loadSettings(defaults, storage)).toEqual({ lang: 'ru' });
  });

  it('ignores the old submit-mode setting', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem('wordfall.settings', '{"mode":"auto","lang":"ru"}');
    expect(loadSettings(defaults, storage)).toEqual({ lang: 'ru' });
  });

  it('falls back to defaults for missing, invalid or unreadable data', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    expect(loadSettings(defaults, storage)).toEqual(defaults);
    storage.setItem('wordfall.settings', '{"lang":"de"}');
    expect(loadSettings(defaults, storage)).toEqual(defaults);
    storage.setItem('wordfall.settings', 'not json');
    expect(loadSettings(defaults, storage)).toEqual(defaults);
    expect(loadSettings(defaults, undefined)).toEqual(defaults);
  });
});
