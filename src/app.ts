import { Dictionary } from './core/dictionary';
import { scoreWord } from './core/scoring';
import { WordTracker, type SubmitResult, type WordStatus } from './core/word-tracker';
import { Game } from './game/game';
import type { Tile } from './game/physics';
import { t, type Language, type StringKey } from './i18n';
import { loadSettings, saveSettings, type Settings } from './settings';

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

/** Wires the game field to the word bar, score, buttons and settings dialog. */
export function startApp(defaultLanguage: Language): void {
  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  })();
  const settings: Settings = loadSettings({ mode: 'button', lang: defaultLanguage }, storage);

  const ui = {
    score: element('#score'),
    word: element('#word'),
    status: element('#status'),
    toast: element('#toast'),
    clear: element<HTMLButtonElement>('#clear-button'),
    submit: element<HTMLButtonElement>('#submit-button'),
    settingsButton: element<HTMLButtonElement>('#settings-button'),
    dialog: element<HTMLDialogElement>('#settings'),
    ruNote: element('#ru-note'),
  };

  const tracker = new WordTracker<Tile>(undefined, settings.mode);
  let dictionaryState: DictionaryState = 'loading';
  let loadToken = 0;
  let score = 0;
  let toastTimer = 0;

  const game = new Game(element<HTMLCanvasElement>('#field'), settings.lang, {
    onTap(tile) {
      if (tracker.includes(tile)) return;
      tile.selected = true;
      handleResult(tracker.add(tile, performance.now()));
      render();
    },
    onFrame(now) {
      if (handleResult(tracker.update(now))) render();
    },
  });

  function handleResult(result: SubmitResult<Tile> | undefined): boolean {
    if (!result) return false;
    if (result.ok) {
      const points = scoreWord(result.word, settings.lang);
      score += points;
      game.removeTiles(result.items);
      showToast(`+${points}  ${result.word}`, 'good');
    } else {
      showToast(t(settings.lang, STATUS_TEXT[result.reason]), 'bad');
    }
    return true;
  }

  function clearWord(): void {
    for (const tile of tracker.items) tile.selected = false;
    tracker.clear();
    render();
  }

  function submitWord(): void {
    if (settings.mode !== 'button' || tracker.status() === 'empty') return;
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
    return t(settings.lang, status === 'empty' ? 'statusEmpty' : STATUS_TEXT[status]);
  }

  function render(): void {
    const status = tracker.status();
    ui.score.textContent = String(score);
    ui.word.textContent = tracker.word;
    ui.status.textContent = statusText(status);
    ui.status.dataset.status = dictionaryState === 'ready' ? status : 'empty';
    ui.clear.disabled = status === 'empty';
    ui.submit.hidden = settings.mode !== 'button';
    ui.submit.disabled = status !== 'valid';
  }

  function translate(): void {
    const lang = settings.lang;
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      el.textContent = t(lang, el.dataset.i18n as StringKey);
    });
    ui.settingsButton.setAttribute('aria-label', t(lang, 'settings'));
    ui.ruNote.textContent = __DICTIONARIES__.includes('ru') ? '' : t(lang, 'noDictionary');
  }

  async function loadWords(): Promise<void> {
    const token = ++loadToken;
    dictionaryState = 'loading';
    tracker.setDictionary(undefined);
    render();
    try {
      const dictionary = await fetchDictionary(settings.lang);
      if (token !== loadToken) return;
      tracker.setDictionary(dictionary);
      dictionaryState = dictionary ? 'ready' : 'missing';
    } catch {
      if (token !== loadToken) return;
      dictionaryState = 'failed';
    }
    render();
  }

  function openSettings(): void {
    game.stop();
    const form = ui.dialog.querySelector('form')!;
    (form.elements.namedItem('mode') as RadioNodeList).value = settings.mode;
    (form.elements.namedItem('lang') as RadioNodeList).value = settings.lang;
    ui.dialog.showModal();
  }

  function applySettings(): void {
    const form = ui.dialog.querySelector('form')!;
    const mode = (form.elements.namedItem('mode') as RadioNodeList).value as Settings['mode'];
    const lang = (form.elements.namedItem('lang') as RadioNodeList).value as Language;
    settings.mode = mode;
    tracker.mode = mode;
    if (lang !== settings.lang) {
      settings.lang = lang;
      score = 0;
      game.reset(lang);
      translate();
      void loadWords();
    }
    saveSettings(settings, storage);
    render();
    game.start();
  }

  ui.clear.addEventListener('click', clearWord);
  ui.submit.addEventListener('click', submitWord);
  ui.settingsButton.addEventListener('click', openSettings);
  ui.dialog.addEventListener('close', applySettings);
  window.addEventListener('keydown', (e) => {
    if (ui.dialog.open) return;
    if (e.key === 'Enter') submitWord();
    else if (e.key === 'Escape' || e.key === 'Backspace') clearWord();
  });

  translate();
  render();
  void loadWords();
  game.start();
}
