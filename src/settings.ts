import type { Language } from './i18n';

/** The game's look: the rounded classic one, or pixel art. */
export type Theme = 'classic' | '8bit';

export interface Settings {
  lang: Language;
  /** Sound effects on or off. */
  sound: boolean;
  theme: Theme;
}

const KEY = 'wordfall.settings';

/** Reads saved settings, falling back to the defaults for anything missing or invalid. */
export function loadSettings(defaults: Settings, storage: Storage | undefined): Settings {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      lang: saved.lang === 'en' || saved.lang === 'ru' ? saved.lang : defaults.lang,
      sound: typeof saved.sound === 'boolean' ? saved.sound : defaults.sound,
      theme: saved.theme === 'classic' || saved.theme === '8bit' ? saved.theme : defaults.theme,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings, storage: Storage | undefined): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); settings then last for this visit only.
  }
}
