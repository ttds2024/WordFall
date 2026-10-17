export type Language = 'en' | 'ru';

/** Each language's name, written in that language. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ru: 'Русский' };

const strings = {
  en: {
    title: 'WordFall',
    score: 'Score',
    settings: 'Settings',
    done: 'Done',
    language: 'Language',
    statusEmpty: 'Tap pumpkins to make a word',
    statusShort: 'At least 3 letters',
    statusValid: 'In the word list',
    statusUnknown: 'Not in the word list',
    statusUsed: 'Already found',
    oneJoker: 'Only one star per word',
    loading: 'Loading words…',
    noDictionary: 'No word list for this language yet',
    loadFailed: 'Could not load the word list',
    signInWith: 'Sign in with',
    signOut: 'Sign out',
    signingIn: 'Signing in…',
    signInFailed: 'Could not sign in. Please try again.',
    time: 'Time',
    menu: 'Menu',
    playTimed: 'Play 5 min',
    playTimedHint: 'Score as much as you can in 5 minutes.',
    playEndless: 'Infinity',
    playEndlessHint: 'No timer. Play as long as you like.',
    timeUp: "Time's up!",
    finalScore: 'Your score',
    opponent: 'Opponent',
    opponentNone: 'None',
    opponentNoneHint: 'Play on your own.',
    opponentBot: 'AI bot',
    opponentBotHint: 'A bot collects words too. About half of its words are right.',
    bot: 'Bot',
    botMissed: 'Bot missed',
    youWin: 'You win!',
    botWins: 'The bot wins!',
    draw: "It's a draw!",
  },
  ru: {
    title: 'WordFall',
    score: 'Очки',
    settings: 'Настройки',
    done: 'Готово',
    language: 'Язык',
    statusEmpty: 'Нажимайте на тыквы, чтобы составить слово',
    statusShort: 'Минимум 3 буквы',
    statusValid: 'Есть в словаре',
    statusUnknown: 'Нет в словаре',
    statusUsed: 'Уже найдено',
    oneJoker: 'В слове может быть только одна звезда',
    loading: 'Загрузка слов…',
    noDictionary: 'Для этого языка пока нет словаря',
    loadFailed: 'Не удалось загрузить словарь',
    signInWith: 'Войти через',
    signOut: 'Выйти',
    signingIn: 'Вход…',
    signInFailed: 'Не удалось войти. Попробуйте ещё раз.',
    time: 'Время',
    menu: 'Меню',
    playTimed: 'Играть 5 мин',
    playTimedHint: 'Наберите как можно больше очков за 5 минут.',
    playEndless: 'Бесконечно',
    playEndlessHint: 'Без таймера. Играйте сколько хотите.',
    timeUp: 'Время вышло!',
    finalScore: 'Ваш счёт',
    opponent: 'Соперник',
    opponentNone: 'Нет',
    opponentNoneHint: 'Играть одному.',
    opponentBot: 'Бот',
    opponentBotHint: 'Бот тоже собирает слова. Примерно половина его слов верна.',
    bot: 'Бот',
    botMissed: 'Бот ошибся',
    youWin: 'Вы победили!',
    botWins: 'Победил бот!',
    draw: 'Ничья!',
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
