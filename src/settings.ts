import type { Language } from './i18n';

/** The game's look: Halloween pumpkins (the original), pixel art, or Christmas baubles. */
export type Theme = 'halloween' | '8bit' | 'christmas';

const THEMES: readonly Theme[] = ['halloween', '8bit', 'christmas'];

/** A saved look, if it is one; 'classic' is what Halloween was called before. */
function readTheme(value: unknown): Theme | undefined {
  if (value === 'classic') return 'halloween';
  return THEMES.find((theme) => theme === value);
}

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
      theme: readTheme(saved.theme) ?? defaults.theme,
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
