export type Language = 'en' | 'ru';

/** Each language's name, written in that language. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ru: 'Русский' };

const strings = {
  en: {
    title: 'WordFall',
    score: 'Score',
    clear: 'Clear',
    settings: 'Settings',
    done: 'Done',
    submitMode: 'Submitting words',
    modeButton: 'By tap',
    modeButtonHint: 'Tap any letter of your word again to check it.',
    modeAuto: 'Automatic',
    modeAutoHint:
      'A word is sent once it is complete, or after a short pause. Tapping one of its letters sends it sooner.',
    language: 'Language',
    statusEmpty: 'Tap pumpkins to make a word',
    statusShort: 'At least 3 letters',
    statusValid: 'In the word list',
    statusUnknown: 'Not in the word list',
    statusUsed: 'Already found',
    loading: 'Loading words…',
    noDictionary: 'No word list for this language yet',
    loadFailed: 'Could not load the word list',
    time: 'Time',
    menu: 'Menu',
    playTimed: 'Play 5 min',
    playTimedHint: 'Score as much as you can in 5 minutes.',
    playEndless: 'Infinity',
    playEndlessHint: 'No timer. Play as long as you like.',
    timeUp: "Time's up!",
    finalScore: 'Your score',
  },
  ru: {
    title: 'WordFall',
    score: 'Очки',
    clear: 'Стереть',
    settings: 'Настройки',
    done: 'Готово',
    submitMode: 'Отправка слов',
    modeButton: 'Нажатием',
    modeButtonHint: 'Нажмите ещё раз на любую букву слова, чтобы проверить его.',
    modeAuto: 'Автоматически',
    modeAutoHint:
      'Слово отправляется, когда оно закончено, или после короткой паузы. Нажатие на его букву отправляет сразу.',
    language: 'Язык',
    statusEmpty: 'Нажимайте на тыквы, чтобы составить слово',
    statusShort: 'Минимум 3 буквы',
    statusValid: 'Есть в словаре',
    statusUnknown: 'Нет в словаре',
    statusUsed: 'Уже найдено',
    loading: 'Загрузка слов…',
    noDictionary: 'Для этого языка пока нет словаря',
    loadFailed: 'Не удалось загрузить словарь',
    time: 'Время',
    menu: 'Меню',
    playTimed: 'Играть 5 мин',
    playTimedHint: 'Наберите как можно больше очков за 5 минут.',
    playEndless: 'Бесконечно',
    playEndlessHint: 'Без таймера. Играйте сколько хотите.',
    timeUp: 'Время вышло!',
    finalScore: 'Ваш счёт',
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
