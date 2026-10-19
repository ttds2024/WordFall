import { setupAuth } from './auth/ui';
import { BOT_ACCURACY, BOT_THINK_MS, BotClock, findWord, pickMiss } from './core/bot';
import { Dictionary } from './core/dictionary';
import { formatTime, ROUND_MS, RoundTimer, type RoundKind } from './core/round';
import { scoreWord, wordMultiplier } from './core/scoring';
import { JOKER } from './core/word';
import { WordTracker, type SubmitResult, type WordStatus } from './core/word-tracker';
import { Game } from './game/game';
import { bumpScore, floatPosition, pointsText, showScoreFloat } from './score-float';
import type { Tile } from './game/physics';
import { t, type Language, type StringKey } from './i18n';
import { loadSettings, saveSettings, type Settings } from './settings';
import { Sounds } from './sound';

type DictionaryState = 'loading' | 'ready' | 'missing' | 'failed';

const STATUS_TEXT: Record<Exclude<WordStatus, 'empty'>, StringKey> = {
  short: 'statusShort',
  valid: 'statusValid',
  unknown: 'statusUnknown',
  used: 'statusUsed',
};

const DICTIONARY_TEXT: Record<Exclude<DictionaryState, 'ready'>, StringKey> = {
  loading: 'loading',
  missing: 'noDictionary',
  failed: 'loadFailed',
};

const TOAST_MS = 1400;
/** The timer turns red in the last this-many milliseconds. */
const LOW_TIME_MS = 30_000;

function element<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

async function fetchDictionary(lang: Language): Promise<Dictionary | undefined> {
  if (!__DICTIONARIES__.includes(lang)) return undefined;
  const response = await fetch(`dict/${lang}.txt`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Dictionary.fromText(await response.text());
}

/** Wires the start menu, game field, word bar, score, timer, buttons and settings dialog. */
export function startApp(defaultLanguage: Language): void {
  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  })();
  const settings: Settings = loadSettings({ lang: defaultLanguage, sound: true }, storage);

  const ui = {
    score: element('#score'),
    versus: element('.versus'),
    vsAvatar: element('#vs-avatar'),
    vsYouScore: element('#vs-you-score'),
    vsBotScore: element('#vs-bot-score'),
    vsRing: element('#vs-ring'),
    vsRingFill: element('#vs-ring-fill'),
    vsSeconds: element('#vs-seconds'),
    resultBot: element('#result-bot'),
    fieldWrap: element('.field-wrap'),
    timer: element('#timer'),
    menu: element('#menu'),
    result: element('#result'),
    resultTitle: element('#result-title'),
    resultScore: element('#result-score'),
    playTimed: element<HTMLButtonElement>('#play-timed'),
    playBot: element<HTMLButtonElement>('#play-bot'),
    menuButton: element<HTMLButtonElement>('#menu-button'),
    menuSettings: element<HTMLButtonElement>('#menu-settings'),
    menuClose: element<HTMLButtonElement>('#menu-close'),
    word: element('#word'),
    multiplier: element('#multiplier'),
    status: element('#status'),
    toast: element('#toast'),
    dialog: element<HTMLDialogElement>('#settings'),
    ruNote: element('#ru-note'),
  };

  const tracker = new WordTracker<Tile>(undefined);
  const sounds = new Sounds();
  sounds.enabled = settings.sound;
  const auth = setupAuth(() => settings.lang);
  let dictionaryState: DictionaryState = 'loading';
  let loadToken = 0;
  let score = 0;
  let toastTimer = 0;
  let round: RoundTimer | undefined;
  let dictionary: Dictionary | undefined;
  // The bot, when playing against one: its score, when it next tries, and the try in progress.
  let botScore = 0;
  let botClock: BotClock | undefined;
  let botTry: { tiles: Tile[]; correct: boolean; word: string; wait: number } | undefined;

  const game = new Game(element<HTMLCanvasElement>('#field'), settings.lang, {
    onTap(tile) {
      // Bombs carry no letter; they only explode. Letters the bot has picked are its own.
      if (tile.kind === 'bomb' || tile.bot) return;
      // Tapping a letter already in the word checks the word.
      if (tracker.includes(tile)) {
        submitWord();
        return;
      }
      if (!tracker.canAdd(tile)) {
        showToast(t(settings.lang, 'oneJoker'), 'bad');
        return;
      }
      tile.selected = true;
      tracker.add(tile);
      sounds.play('clicked');
      render();
    },
    onTapEmpty: clearWord,
    onExplode(destroyed) {
      tracker.remove(destroyed);
      render();
    },
    onFrame(_now, elapsed) {
      if (!round) return;
      if (round.advance(elapsed)) {
        endRound();
        return;
      }
      updateBot(elapsed);
      render();
    },
  });

  function handleResult(result: SubmitResult<Tile> | undefined): boolean {
    if (!result) return false;
    if (result.ok) {
      // Letters are scored as tapped, so a joker counts 0, like a blank in Scrabble.
      const letters = result.items.map((tile) => tile.letter).join('');
      const multiplier = wordMultiplier(result.items);
      const points = scoreWord(letters, settings.lang) * multiplier;
      score += points;
      // The word and its points rise from where its tiles were.
      const at = floatPosition(
        result.items.map((tile) => tile.body.position),
        ui.fieldWrap.clientWidth,
        ui.fieldWrap.clientHeight,
      );
      game.removeTiles(result.items);
      showScoreFloat(ui.fieldWrap, at, pointsText(points, multiplier), result.word);
      sounds.play('success');
      bumpScore(botClock ? ui.vsYouScore : ui.score);
    } else {
      showToast(t(settings.lang, STATUS_TEXT[result.reason]), 'bad');
    }
    return true;
  }

  /** Advances the bot: starts a try when it is due, and checks the word once it has "thought". */
  function updateBot(ms: number): void {
    if (!botClock || !dictionary) return;
    if (botTry) {
      botTry.wait -= ms;
      if (botTry.wait <= 0) finishBotTry();
    } else if (botClock.advance(ms)) {
      startBotTry(dictionary);
    }
  }

  /**
   * The bot picks letters from the field (never a star or a bad pumpkin): a real word not found
   * yet with probability BOT_ACCURACY, otherwise letters that spell nothing. It goes for letters
   * the player has not picked first; only if those give it nothing does it take the player's.
   */
  function startBotTry(words: Dictionary): void {
    const letterTiles = game
      .tiles()
      .filter((tile) => tile.kind === 'pumpkin' || tile.kind === 'double');
    const correct = Math.random() < BOT_ACCURACY;
    const free = letterTiles.filter((tile) => !tile.selected);
    const pick =
      pickTiles(free, words, correct) ??
      (free.length < letterTiles.length ? pickTiles(letterTiles, words, correct) : undefined);
    if (!pick) return;
    // Letters it takes from the player's word leave that word.
    const taken = pick.tiles.filter((tile) => tile.selected);
    for (const tile of taken) tile.selected = false;
    tracker.remove(taken);
    for (const tile of pick.tiles) tile.bot = true;
    botTry = {
      tiles: pick.tiles,
      correct: pick.correct,
      word: pick.tiles.map((t) => t.letter).join(''),
      wait: BOT_THINK_MS,
    };
  }

  /** The bot's letters from these tiles: a word if it should be right and can be, else a miss. */
  function pickTiles(
    tiles: Tile[],
    words: Dictionary,
    tryWord: boolean,
  ): { tiles: Tile[]; correct: boolean } | undefined {
    const letters = tiles.map((tile) => tile.letter);
    const word = tryWord ? findWord(letters, words.all, (w) => tracker.isUsed(w)) : undefined;
    const picks = word ?? pickMiss(letters, (w) => words.has(w));
    return picks && { tiles: picks.map((i) => tiles[i]!), correct: word !== undefined };
  }

  function finishBotTry(): void {
    if (!botTry) return;
    const { tiles, correct, word } = botTry;
    botTry = undefined;
    for (const tile of tiles) tile.bot = false;
    // A bomb may have taken some of its letters meanwhile.
    const onField = game.tiles();
    if (!tiles.every((tile) => onField.includes(tile))) return;
    const at = floatPosition(
      tiles.map((tile) => tile.body.position),
      ui.fieldWrap.clientWidth,
      ui.fieldWrap.clientHeight,
    );
    // The player may have found the same word while the bot was thinking.
    if (correct && !tracker.isUsed(word)) {
      const multiplier = wordMultiplier(tiles);
      const points = scoreWord(word, settings.lang) * multiplier;
      botScore += points;
      tracker.markUsed(word);
      game.removeTiles(tiles);
      showScoreFloat(ui.fieldWrap, at, `🤖 ${pointsText(points, multiplier)}`, word, 'bot');
      bumpScore(ui.vsBotScore);
    } else {
      showScoreFloat(ui.fieldWrap, at, t(settings.lang, 'botMissed'), word, 'bot');
    }
  }

  function stopBot(): void {
    for (const tile of botTry?.tiles ?? []) tile.bot = false;
    botTry = undefined;
  }

  function startRound(kind: RoundKind): void {
    round = new RoundTimer(kind);
    score = 0;
    stopBot();
    botScore = 0;
    botClock = kind === 'bot' ? new BotClock() : undefined;
    // Against the bot the top bar shows both scores and a timer ring instead.
    if (kind === 'bot') document.getElementById('app')!.dataset.mode = 'bot';
    else delete document.getElementById('app')!.dataset.mode;
    ui.versus.hidden = kind !== 'bot';
    ui.vsAvatar.textContent = (auth.name() ?? t(settings.lang, 'you')).charAt(0).toUpperCase();
    tracker.reset();
    game.reset();
    ui.menuClose.hidden = true;
    ui.menu.hidden = true;
    render();
    game.start();
  }

  /** ☰ during a round: pauses it (timer and bot included) and opens the menu, with ✕ to resume. */
  function pauseRound(): void {
    if (!round) return;
    game.stop();
    ui.result.hidden = true;
    ui.menuClose.hidden = false;
    ui.menu.hidden = false;
  }

  /** ✕ (or Esc) on the menu of a paused round: back to the game where it was left. */
  function resumeRound(): void {
    if (!round || ui.menuClose.hidden) return;
    ui.menuClose.hidden = true;
    ui.menu.hidden = true;
    game.start();
  }

  /** Drops a paused round without a result, e.g. when the language changes under it. */
  function dropRound(): void {
    round = undefined;
    stopBot();
    clearWord();
    ui.menuClose.hidden = true;
  }

  /** Stops play and shows the menu with the score; timeUp says the clock ran out. */
  function endRound(): void {
    if (!round) return;
    const timeUp = round.over;
    round = undefined;
    ui.menuClose.hidden = true;
    game.stop();
    stopBot();
    clearWord();
    // Against the bot, the title says who won; otherwise whether time ran out.
    const title = botClock
      ? t(settings.lang, score > botScore ? 'youWin' : score < botScore ? 'botWins' : 'draw')
      : timeUp
        ? t(settings.lang, 'timeUp')
        : '';
    ui.resultTitle.textContent = title;
    ui.resultTitle.hidden = !title;
    ui.resultScore.textContent = String(score);
    ui.resultBot.textContent = `🤖 ${t(settings.lang, 'bot')}: ${botScore}`;
    ui.resultBot.hidden = !botClock;
    ui.result.hidden = false;
    ui.menu.hidden = false;
  }

  function clearWord(): void {
    for (const tile of tracker.items) tile.selected = false;
    tracker.clear();
    render();
  }

  function submitWord(): void {
    if (tracker.status() === 'empty') return;
    handleResult(tracker.submit());
    render();
  }

  function showToast(text: string, kind: 'good' | 'bad'): void {
    ui.toast.textContent = text;
    ui.toast.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (ui.toast.className = 'toast'), TOAST_MS);
  }

  function statusText(status: WordStatus): string {
    if (dictionaryState !== 'ready' && status !== 'short') {
      return t(settings.lang, DICTIONARY_TEXT[dictionaryState]);
    }
    const text = t(settings.lang, status === 'empty' ? 'statusEmpty' : STATUS_TEXT[status]);
    // With a joker, say which word it makes.
    const resolved = tracker.resolved;
    return resolved && tracker.word.includes(JOKER) ? `${text}: ${resolved.toUpperCase()}` : text;
  }

  function render(): void {
    const status = tracker.status();
    ui.score.textContent = String(score);
    const remaining = round?.remaining;
    if (botClock && remaining !== undefined) renderVersus(remaining);
    ui.timer.textContent = remaining === undefined ? '' : formatTime(remaining);
    ui.timer.classList.toggle('low', remaining !== undefined && remaining <= LOW_TIME_MS);
    ui.word.textContent = tracker.word;
    const multiplier = wordMultiplier(tracker.items);
    ui.multiplier.textContent = `×${multiplier}`;
    ui.multiplier.hidden = multiplier === 1;
    ui.status.textContent = statusText(status);
    ui.status.dataset.status = dictionaryState === 'ready' ? status : 'empty';
  }

  /** The Player vs AI bar: both scores, and the ring emptying with the seconds left. */
  function renderVersus(remaining: number): void {
    ui.vsYouScore.textContent = String(score);
    ui.vsBotScore.textContent = String(botScore);
    const seconds = Math.ceil(remaining / 1000);
    ui.vsSeconds.textContent = String(seconds);
    ui.vsRingFill.style.strokeDasharray = `${(remaining / ROUND_MS) * 100} 100`;
    ui.vsRing.classList.toggle('low', remaining <= LOW_TIME_MS);
    ui.vsRing.setAttribute('aria-label', `${seconds} ${t(settings.lang, 'sec')}`);
  }

  function translate(): void {
    const lang = settings.lang;
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      el.textContent = t(lang, el.dataset.i18n as StringKey);
    });
    ui.menuButton.setAttribute('aria-label', t(lang, 'menu'));
    ui.menuClose.setAttribute('aria-label', t(lang, 'resume'));
    ui.timer.setAttribute('aria-label', t(lang, 'time'));
    ui.ruNote.textContent = __DICTIONARIES__.includes('ru') ? '' : t(lang, 'noDictionary');
    auth.render();
  }

  async function loadWords(): Promise<void> {
    const token = ++loadToken;
    dictionaryState = 'loading';
    dictionary = undefined;
    tracker.setDictionary(undefined);
    render();
    try {
      const loaded = await fetchDictionary(settings.lang);
      if (token !== loadToken) return;
      dictionary = loaded;
      tracker.setDictionary(loaded);
      dictionaryState = loaded ? 'ready' : 'missing';
    } catch {
      if (token !== loadToken) return;
      dictionaryState = 'failed';
    }
    render();
  }

  /** Settings open from the start menu only, so no round is running meanwhile. */
  function openSettings(): void {
    const form = ui.dialog.querySelector('form')!;
    (form.elements.namedItem('lang') as RadioNodeList).value = settings.lang;
    (form.elements.namedItem('sound') as RadioNodeList).value = settings.sound ? 'on' : 'off';
    ui.dialog.showModal();
  }

  function applySettings(): void {
    const form = ui.dialog.querySelector('form')!;
    const lang = (form.elements.namedItem('lang') as RadioNodeList).value as Language;
    settings.sound = (form.elements.namedItem('sound') as RadioNodeList).value === 'on';
    sounds.enabled = settings.sound;
    if (lang !== settings.lang) {
      settings.lang = lang;
      // New letters and words: a paused round cannot go on.
      dropRound();
      game.reset(lang);
      translate();
      void loadWords();
    }
    saveSettings(settings, storage);
  }

  ui.menuSettings.addEventListener('click', openSettings);
  ui.menuButton.addEventListener('click', pauseRound);
  ui.menuClose.addEventListener('click', resumeRound);
  ui.playTimed.addEventListener('click', () => startRound('solo'));
  ui.playBot.addEventListener('click', () => startRound('bot'));
  ui.dialog.addEventListener('close', applySettings);
  window.addEventListener('keydown', (e) => {
    if (ui.dialog.open || !round) return;
    if (!ui.menu.hidden) {
      if (e.key === 'Escape') resumeRound();
      return;
    }
    if (e.key === 'Enter') submitWord();
    else if (e.key === 'Escape' || e.key === 'Backspace') clearWord();
  });

  translate();
  render();
  void loadWords();
}
