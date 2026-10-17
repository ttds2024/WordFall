import type { Language } from './i18n';

/** Whether a bot plays against the player. */
export type Opponent = 'none' | 'bot';

export interface Settings {
  lang: Language;
  opponent: Opponent;
}

const KEY = 'wordfall.settings';

/** Reads saved settings, falling back to the defaults for anything missing or invalid. */
export function loadSettings(defaults: Settings, storage: Storage | undefined): Settings {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      lang: saved.lang === 'en' || saved.lang === 'ru' ? saved.lang : defaults.lang,
      opponent:
        saved.opponent === 'none' || saved.opponent === 'bot' ? saved.opponent : defaults.opponent,
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
