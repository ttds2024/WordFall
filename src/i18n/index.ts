export type Language = 'en' | 'ru';

/** Each language's name, written in that language. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ru: 'Русский' };

const strings = {
  en: {
    title: 'WordFall',
    settings: 'Settings',
    done: 'Done',
    language: 'Language',
    statusEmpty: 'Tap pumpkins to make a word',
    statusShort: 'At least 3 letters',
    statusValid: 'In the word list',
    statusUnknown: 'Not in the word list',
    statusUsed: 'Already found',
    oneJoker: 'Only one star per word',
    noJokers: 'No stars yet: tap a falling star to collect it',
    useJoker: 'Use a star',
    jokersFull: 'You can hold at most 3 stars',
    loading: 'Loading words…',
    noDictionary: 'No word list for this language yet',
    loadFailed: 'Could not load the word list',
    signInWith: 'Sign in with',
    signOut: 'Sign out',
    signingIn: 'Signing in…',
    signInFailed: 'Could not sign in. Please try again.',
    menu: 'Menu',
    resume: 'Back to the game',
    playTimed: 'Play 2 min',
    playTimedHint: 'Score as much as you can in 2 minutes.',
    playBot: 'Play vs AI',
    playBotHint: '2 minutes against a bot that collects words too.',
    timeUp: "Time's up!",
    finalScore: 'Your score',
    playAgain: 'Play again',
    sound: 'Sound',
    soundOn: 'On',
    soundOff: 'Off',
    theme: 'Style',
    themeHalloween: 'Halloween',
    theme8bit: '8-bit',
    themeChristmas: 'Christmas',
    bot: 'Bot',
    you: 'You',
    sec: 'sec',
    botMissed: 'Bot missed',
    youWin: 'You win!',
    botWins: 'The bot wins!',
    draw: "It's a draw!",
  },
  ru: {
    title: 'WordFall',
    settings: 'Настройки',
    done: 'Готово',
    language: 'Язык',
    statusEmpty: 'Нажимайте на тыквы, чтобы составить слово',
    statusShort: 'Минимум 3 буквы',
    statusValid: 'Есть в словаре',
    statusUnknown: 'Нет в словаре',
    statusUsed: 'Уже найдено',
    oneJoker: 'В слове может быть только одна звезда',
    noJokers: 'Звёзд пока нет: нажмите на падающую звезду, чтобы взять её',
    useJoker: 'Использовать звезду',
    jokersFull: 'Можно держать не больше 3 звёзд',
    loading: 'Загрузка слов…',
    noDictionary: 'Для этого языка пока нет словаря',
    loadFailed: 'Не удалось загрузить словарь',
    signInWith: 'Войти через',
    signOut: 'Выйти',
    signingIn: 'Вход…',
    signInFailed: 'Не удалось войти. Попробуйте ещё раз.',
    menu: 'Меню',
    resume: 'Вернуться в игру',
    playTimed: 'Играть 2 мин',
    playTimedHint: 'Наберите как можно больше очков за 2 минуты.',
    playBot: 'Играть против ИИ',
    playBotHint: '2 минуты против бота, который тоже собирает слова.',
    timeUp: 'Время вышло!',
    finalScore: 'Ваш счёт',
    playAgain: 'Играть ещё',
    sound: 'Звук',
    soundOn: 'Включён',
    soundOff: 'Выключен',
    theme: 'Стиль',
    themeHalloween: 'Хэллоуин',
    theme8bit: '8-бит',
    themeChristmas: 'Рождество',
    bot: 'Бот',
    you: 'Вы',
    sec: 'сек',
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
