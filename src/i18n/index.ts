export type Language = 'en' | 'ru';

const strings = {
  en: {
    title: 'WordFall',
    comingSoon: 'Coming soon…',
  },
  ru: {
    title: 'WordFall',
    comingSoon: 'Скоро…',
  },
} satisfies Record<Language, Record<string, string>>;

export type StringKey = keyof (typeof strings)['en'];

export function t(lang: Language, key: StringKey): string {
  return strings[lang][key];
}

/** Picks the first supported language from the browser's preference list; English otherwise. */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'ru' || base === 'en') return base;
  }
  return 'en';
}
