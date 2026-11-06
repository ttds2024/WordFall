import { setupAuth } from './auth/ui';
import { BOT_ACCURACY, BOT_THINK_MS, BotClock, findWord, pickMiss } from './core/bot';
import { Dictionary } from './core/dictionary';
import { seededRandom } from './core/random';
import { ROUND_MS, RoundTimer, type RoundKind } from './core/round';
import { scoreWord, wordMultiplier } from './core/scoring';
import { JOKER } from './core/word';
import { WordTracker, type SubmitResult, type WordStatus } from './core/word-tracker';
import { Game } from './game/game';
import { bumpScore, floatPosition, pointsText, showScoreFloat } from './score-float';
import type { Tile } from './game/physics';
import { t, type Language, type StringKey } from './i18n';
import {
  JoinFailed,
  OnlineMatch,
  SERVER_URL,
  type JoinRequest,
  type MatchView,
} from './online/match';
import type { Verdict } from './online/protocol';
import { loadSettings, saveSettings, type Settings, type Theme } from './settings';
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

const VERDICT_TEXT: Record<Extract<Verdict, { ok: false }>['reason'], StringKey> = {
  invalid: 'statusUnknown',
  short: 'statusShort',
  unknown: 'statusUnknown',
  used: 'statusUsed',
};

const TOAST_MS = 1400;
/** A joker from the player's stock in the word being built; it is not a tile on the field. */
const HAND_JOKER = { letter: JOKER, kind: 'joker' } as const;
type WordItem = Tile | typeof HAND_JOKER;
/** Stars in the player's stock at the start of a round, and the most it can hold. */
const START_JOKERS = 1;
const MAX_JOKERS = 3;

function isTile(item: WordItem): item is Tile {
  return item !== HAND_JOKER;
}

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
  const settings: Settings = loadSettings(
    { lang: defaultLanguage, sound: true, theme: 'halloween' },
    storage,
  );

  const ui = {
    vsAvatar: element('#vs-avatar'),
    vsYouScore: element('#vs-you-score'),
    vsBotScore: element('#vs-bot-score'),
    jokerButton: element<HTMLButtonElement>('#joker-button'),
    jokerCount: element('#joker-count'),
    vsRing: element('#vs-ring'),
    vsRingFill: element('#vs-ring-fill'),
    vsSeconds: element('#vs-seconds'),
    resultBot: element('#result-bot'),
    resultBotBox: element('#result-bot-box'),
    fieldWrap: element('.field-wrap'),
    menu: element('#menu'),
    result: element<HTMLDialogElement>('#result'),
    resultTitle: element('#result-title'),
    resultScore: element('#result-score'),
    playTimed: element<HTMLButtonElement>('#play-timed'),
    playBot: element<HTMLButtonElement>('#play-bot'),
    playOnline: element<HTMLButtonElement>('#play-online'),
    playFriend: element<HTMLButtonElement>('#play-friend'),
    vsRival: element('#vs-rival'),
    vsRivalAvatar: element('#vs-rival-avatar'),
    vsRivalLabel: element('#vs-rival-label'),
    resultRivalLabel: element('#result-rival-label'),
    lobby: element<HTMLDialogElement>('#lobby'),
    lobbyTitle: element('#lobby-title'),
    lobbyFriend: element('#lobby-friend'),
    lobbyCreate: element<HTMLButtonElement>('#lobby-create'),
    lobbyCodeInput: element<HTMLInputElement>('#lobby-code-input'),
    lobbyJoin: element<HTMLButtonElement>('#lobby-join'),
    lobbyCode: element('#lobby-code'),
    lobbyCodeValue: element('#lobby-code-value'),
    lobbyStatus: element('#lobby-status'),
    lobbyCancel: element<HTMLButtonElement>('#lobby-cancel'),
    menuButton: element<HTMLButtonElement>('#menu-button'),
    menuSettings: element<HTMLButtonElement>('#menu-settings'),
    menuClose: element<HTMLButtonElement>('#menu-close'),
    word: element('#word'),
    multiplier: element('#multiplier'),
    status: element('#status'),
    toast: element('#toast'),
    dialog: element<HTMLDialogElement>('#settings'),
    langRu: element<HTMLOptionElement>('#lang-ru'),
  };

  const tracker = new WordTracker<WordItem>(undefined);
  const sounds = new Sounds();
  sounds.enabled = settings.sound;
  const auth = setupAuth(() => settings.lang);
  let dictionaryState: DictionaryState = 'loading';
  let loadToken = 0;
  let score = 0;
  /** Stars collected this round and not spent yet (one may be in the word being built). */
  let jokers = 0;
  let toastTimer = 0;
  let round: RoundTimer | undefined;
  /** The kind of the last round started, for "Play again". */
  let lastKind: RoundKind = 'solo';
  let dictionary: Dictionary | undefined;
  // The bot, when playing against one: its score, when it next tries, and the try in progress.
  let rivalScore = 0;
  let botClock: BotClock | undefined;
  let botTry: { tiles: Tile[]; correct: boolean; word: string; wait: number } | undefined;
  /** The bot's robot icon, put back in the rival's avatar after an online round. */
  const botAvatar = ui.vsRivalAvatar.innerHTML;

  // Online: the match on the server, what it last showed, and words waiting for its verdict.
  let match: OnlineMatch | undefined;
  let matchView: MatchView | undefined;
  /** How the player got into the match, so "Play again" can find a new one the same way. */
  let onlineRequest: JoinRequest['kind'] = 'quick';
  /** The seed of the online round being played, so each round starts once. */
  let onlineSeed: number | undefined;
  /** Words sent to the server, oldest first; their tiles stay on the field until it answers. */
  const pending: { items: WordItem[]; tiles: Tile[] }[] = [];

  const game = new Game(element<HTMLCanvasElement>('#field'), settings.lang, {
    onTap(tile) {
      // Bombs carry no letter; they only explode. Letters the bot has picked are its own.
      if (tile.kind === 'bomb' || tile.bot || isPending(tile)) return;
      // A green pumpkin blows up, with the tiles around it.
      if (tile.kind === 'green') {
        game.explode(tile);
        return;
      }
      // A star goes into the player's stock, to be used from the top bar whenever they like.
      if (tile.kind === 'joker') {
        collectJoker(tile);
        return;
      }
      // Tapping a letter already in the word checks the word.
      if (tracker.includes(tile)) {
        submitWord();
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
      // Online, the server's clock ends the round.
      if (round.advance(elapsed) && round.kind !== 'online') {
        endRound();
        return;
      }
      updateBot(elapsed);
      render();
    },
  });

  function handleResult(result: SubmitResult<WordItem> | undefined): boolean {
    if (!result) return false;
    if (result.ok) {
      scored(result.items, result.word, scoreWord(result.word) * wordMultiplier(result.items));
    } else {
      showToast(t(settings.lang, STATUS_TEXT[result.reason]), 'bad');
    }
    return true;
  }

  /** A word of the player's scored: points, the stock's star spent, its tiles gone. */
  function scored(items: readonly WordItem[], word: string, points: number): void {
    score += points;
    // A joker from the stock is spent once its word scores.
    if (items.includes(HAND_JOKER)) jokers--;
    const tiles = items.filter(isTile);
    // The word and its points rise from where its tiles were.
    const at = floatPosition(
      tiles.map((tile) => tile.body.position),
      ui.fieldWrap.clientWidth,
      ui.fieldWrap.clientHeight,
    );
    game.removeTiles(tiles);
    showScoreFloat(ui.fieldWrap, at, pointsText(points), word);
    sounds.play('success');
    bumpScore(ui.vsYouScore);
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
   * The bot picks letters from the field (never a star, a bad pumpkin or a green one): a real word not found
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
      const points = scoreWord(word) * multiplier;
      rivalScore += points;
      tracker.markUsed(word);
      game.removeTiles(tiles);
      showScoreFloat(ui.fieldWrap, at, `🤖 ${pointsText(points)}`, word, 'bot');
      bumpScore(ui.vsBotScore);
    } else {
      showScoreFloat(ui.fieldWrap, at, t(settings.lang, 'botMissed'), word, 'bot');
    }
  }

  function stopBot(): void {
    for (const tile of botTry?.tiles ?? []) tile.bot = false;
    botTry = undefined;
  }

  /** Starts a round; an online one takes its letters from the match's seed. */
  function startRound(kind: RoundKind, seed?: number): void {
    // A round on this device ends any online match.
    if (kind !== 'online') leaveMatch();
    lastKind = kind;
    round = new RoundTimer(kind);
    score = 0;
    jokers = START_JOKERS;
    stopBot();
    pending.length = 0;
    rivalScore = 0;
    botClock = kind === 'bot' ? new BotClock() : undefined;
    // Against the bot, or online, the top bar also shows the rival's score.
    document.getElementById('app')!.dataset.mode = kind;
    ui.vsAvatar.textContent = (auth.name() ?? t(settings.lang, 'you')).charAt(0).toUpperCase();
    renderRival();
    tracker.reset();
    game.reset(settings.lang, seed === undefined ? Math.random : seededRandom(seed));
    ui.menuClose.hidden = true;
    ui.menu.hidden = true;
    render();
    game.start();
  }

  /** ☰ during a round: pauses it (timer and bot included) and opens the menu, with ✕ to resume. */
  function pauseRound(): void {
    if (!round) return;
    game.stop();
    ui.menuClose.hidden = false;
    ui.menu.hidden = false;
  }

  /** ✕ (or Esc) on the menu of a paused round: back to the game where it was left. */
  function resumeRound(): void {
    if (!round || ui.menuClose.hidden) return;
    // Online the round went on meanwhile.
    if (round.kind === 'online' && matchView) round.sync(matchView.timeLeftMs);
    ui.menuClose.hidden = true;
    ui.menu.hidden = true;
    game.start();
  }

  /** Drops a paused round without a result, e.g. when the language changes under it. */
  function dropRound(): void {
    leaveMatch();
    round = undefined;
    stopBot();
    clearWord();
    ui.menuClose.hidden = true;
  }

  /**
   * Stops play and shows the result in its own window, over the start menu. `note` replaces the
   * title, e.g. when the connection to the server is lost.
   */
  function endRound(note?: string): void {
    if (!round) return;
    const timeUp = round.over;
    const versus = round.kind !== 'solo';
    round = undefined;
    ui.menuClose.hidden = true;
    game.stop();
    stopBot();
    clearWord();
    for (const { tiles } of pending) for (const tile of tiles) tile.selected = false;
    pending.length = 0;
    // Against the bot or online, the title says who won; otherwise whether time ran out.
    const winner = score > rivalScore ? 'youWin' : score < rivalScore ? 'rivalWins' : 'draw';
    const title =
      note ??
      (versus
        ? t(settings.lang, winner === 'rivalWins' && lastKind === 'bot' ? 'botWins' : winner)
        : timeUp
          ? t(settings.lang, 'timeUp')
          : '');
    ui.resultTitle.textContent = title;
    ui.resultTitle.hidden = !title;
    ui.resultScore.textContent = String(score);
    ui.resultBot.textContent = String(rivalScore);
    ui.resultBotBox.hidden = !versus;
    ui.resultRivalLabel.textContent = rivalName();
    ui.menu.hidden = false;
    ui.result.showModal();
  }

  /**
   * Closing the result: "Play again" starts the same kind of round (online, a rematch with the
   * same player, or a new match if the old one is gone); otherwise the menu stays.
   */
  function closeResult(): void {
    const again = ui.result.returnValue === 'again';
    ui.result.returnValue = '';
    if (lastKind !== 'online') {
      if (again) startRound(lastKind);
      return;
    }
    if (!again) {
      leaveMatch();
      return;
    }
    if (match && matchView?.rival?.connected) {
      match.rematch();
      showLobby(t(settings.lang, 'waitingRematch'));
    } else {
      leaveMatch();
      if (onlineRequest === 'quick') void joinMatch({ kind: 'quick' });
      else openFriendLobby();
    }
  }

  /** A tapped star leaves the field and joins the player's stock; with a full stock it stays. */
  function collectJoker(tile: Tile): void {
    if (jokers >= MAX_JOKERS) {
      showToast(t(settings.lang, 'jokersFull'), 'bad');
      return;
    }
    game.removeTiles([tile]);
    jokers++;
    sounds.play('clicked');
    bumpScore(ui.jokerButton);
    render();
  }

  /** The joker button (or *): puts a star from the stock into the word, at most one per word. */
  function useJoker(): void {
    if (!round || !ui.menu.hidden) return;
    if (tracker.includes(HAND_JOKER)) {
      showToast(t(settings.lang, 'oneJoker'), 'bad');
      return;
    }
    if (jokers - pendingJokers() === 0) {
      showToast(t(settings.lang, 'noJokers'), 'bad');
      return;
    }
    tracker.add(HAND_JOKER);
    sounds.play('clicked');
    render();
  }

  function clearWord(): void {
    for (const item of tracker.items) if (isTile(item)) item.selected = false;
    tracker.clear();
    render();
  }

  function submitWord(): void {
    if (tracker.status() === 'empty') return;
    const result = tracker.submit();
    if (match && round?.kind === 'online' && result.ok) {
      // Online the server has the last word: the tiles wait, still lit, for its verdict.
      const tiles = result.items.filter(isTile);
      pending.push({ items: result.items, tiles });
      match.submit(
        result.items.map((item) => item.letter).join(''),
        result.items.filter((item) => item.kind === 'double').length,
      );
    } else handleResult(result);
    render();
  }

  function isPending(tile: Tile): boolean {
    return pending.some(({ tiles }) => tiles.includes(tile));
  }

  /** Stars in words still waiting for the server: not spent yet, but not free either. */
  function pendingJokers(): number {
    return pending.filter(({ items }) => items.includes(HAND_JOKER)).length;
  }

  /** The server's answer to the oldest word sent. */
  function handleVerdict(verdict: Verdict): void {
    const sent = pending.shift();
    if (!sent || !round) return;
    if (verdict.ok) {
      scored(sent.items, verdict.word, verdict.points);
    } else {
      // Most likely the rival found it first.
      for (const tile of sent.tiles) tile.selected = false;
      showToast(t(settings.lang, VERDICT_TEXT[verdict.reason]), 'bad');
    }
    render();
  }

  /** The rival scored: the word is taken, and its points rise from the top of the field. */
  function handleRivalWord(word: string, points: number): void {
    if (!round) return;
    tracker.markUsed(word);
    const width = ui.fieldWrap.clientWidth;
    const at = floatPosition([{ x: width / 2, y: 0 }], width, ui.fieldWrap.clientHeight);
    showScoreFloat(ui.fieldWrap, at, pointsText(points), word, 'bot');
    bumpScore(ui.vsBotScore);
    render();
  }

  function rivalName(): string {
    if (lastKind === 'online') return matchView?.rival?.name ?? t(settings.lang, 'rival');
    return t(settings.lang, 'bot');
  }

  /** The rival's card: the robot against the bot, the other player's initial and name online. */
  function renderRival(): void {
    const online = lastKind === 'online';
    const name = rivalName();
    ui.vsRivalLabel.textContent = name;
    ui.vsRivalLabel.title = name;
    if (online) ui.vsRivalAvatar.textContent = name.charAt(0).toUpperCase();
    else if (ui.vsRivalAvatar.innerHTML !== botAvatar) ui.vsRivalAvatar.innerHTML = botAvatar;
    ui.vsRival.classList.toggle('offline', online && matchView?.rival?.connected === false);
  }

  /** Opens the lobby with a message, as for a quick match or a rematch. */
  function showLobby(status: string, bad = false): void {
    ui.lobbyTitle.textContent = t(
      settings.lang,
      onlineRequest === 'quick' ? 'playOnline' : 'playFriend',
    );
    ui.lobbyFriend.hidden = true;
    ui.lobbyCode.hidden = true;
    setLobbyStatus(status, bad);
    if (!ui.lobby.open) ui.lobby.showModal();
  }

  function setLobbyStatus(status: string, bad = false): void {
    ui.lobbyStatus.textContent = status;
    ui.lobbyStatus.classList.toggle('bad', bad);
  }

  /** Playing with a friend: create a room, or enter the code of theirs. */
  function openFriendLobby(error?: string): void {
    onlineRequest = 'create';
    showLobby(error ?? '', error !== undefined);
    ui.lobbyFriend.hidden = false;
    ui.lobbyCreate.disabled = false;
    ui.lobbyJoin.disabled = false;
    ui.lobbyCodeInput.value = '';
  }

  /** Connects to the server and joins a match the way `request` says. */
  async function joinMatch(request: JoinRequest): Promise<void> {
    if (!SERVER_URL) return;
    leaveMatch();
    onlineRequest = request.kind;
    showLobby(t(settings.lang, 'connecting'));
    try {
      const joined = await OnlineMatch.join(
        request,
        {
          url: SERVER_URL,
          lang: settings.lang,
          name: auth.name() ?? t(settings.lang, 'guest'),
        },
        {
          onUpdate: updateMatch,
          onVerdict: handleVerdict,
          onRivalWord: handleRivalWord,
          onClosed: matchClosed,
        },
      );
      // Cancelled while connecting.
      if (!ui.lobby.open) {
        joined.leave();
        return;
      }
      match = joined;
      onlineSeed = undefined;
      if (request.kind === 'create') {
        ui.lobbyCode.hidden = false;
        ui.lobbyCodeValue.textContent = joined.code;
        setLobbyStatus(t(settings.lang, 'shareCode'));
      } else setLobbyStatus(t(settings.lang, 'searching'));
      updateMatch(joined.view());
    } catch (error) {
      if (!ui.lobby.open) return;
      const reason = error instanceof JoinFailed ? error.reason : 'unavailable';
      if (request.kind === 'join') {
        openFriendLobby(t(settings.lang, reason === 'notFound' ? 'roomNotFound' : 'roomFull'));
      } else if (request.kind === 'create') {
        openFriendLobby(t(settings.lang, 'serverUnavailable'));
      } else setLobbyStatus(t(settings.lang, 'serverUnavailable'), true);
    }
  }

  /** Follows the match on the server: the countdown, the round's start and end, the scores. */
  function updateMatch(view: MatchView): void {
    matchView = view;
    const { phase } = view;
    if (phase === 'countdown') {
      onlineSeed = undefined;
      const seconds = Math.ceil(view.timeLeftMs / 1000);
      showLobby(`${t(settings.lang, 'startingIn')} ${seconds}…`);
    } else if (phase === 'playing' && onlineSeed !== view.seed) {
      onlineSeed = view.seed;
      closeLobby();
      ui.result.close();
      startRound('online', view.seed);
    } else if (phase === 'finished' && round?.kind === 'online') {
      endRound();
    } else if (phase === 'finished' && ui.lobby.open && view.rival?.connected === false) {
      setLobbyStatus(t(settings.lang, 'rivalLeft'), true);
    }
    if (round?.kind === 'online') {
      if (Math.abs(round.remaining - view.timeLeftMs) > 1000) round.sync(view.timeLeftMs);
      score = view.score;
      rivalScore = view.rival?.score ?? 0;
      renderRival();
      render();
    }
  }

  /** The server is gone for good (the SDK has already tried to reconnect). */
  function matchClosed(): void {
    match = undefined;
    matchView = undefined;
    if (round?.kind === 'online') endRound(t(settings.lang, 'connectionLost'));
    else if (ui.lobby.open) setLobbyStatus(t(settings.lang, 'connectionLost'), true);
  }

  /** Leaves the online match, if any, e.g. for a round on this device. */
  function leaveMatch(): void {
    // A paused online round cannot be resumed without its match.
    if (round?.kind === 'online') {
      round = undefined;
      game.stop();
      clearWord();
      ui.menuClose.hidden = true;
    }
    match?.leave();
    match = undefined;
    matchView = undefined;
    onlineSeed = undefined;
    closeLobby();
  }

  function closeLobby(): void {
    if (ui.lobby.open) ui.lobby.close();
  }

  /** Cancel (or Esc) in the lobby: out of the match, back to the menu. */
  function cancelLobby(): void {
    match?.leave();
    match = undefined;
    matchView = undefined;
  }

  function joinByCode(): void {
    const code = ui.lobbyCodeInput.value.trim().toUpperCase();
    if (code.length === 0) {
      ui.lobbyCodeInput.focus();
      return;
    }
    void joinMatch({ kind: 'join', code });
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
    const remaining = round?.remaining;
    if (remaining !== undefined) renderBar(remaining);
    ui.word.textContent = tracker.word;
    const multiplier = wordMultiplier(tracker.items);
    ui.multiplier.textContent = `×${multiplier}`;
    ui.multiplier.hidden = multiplier === 1;
    ui.status.textContent = statusText(status);
    ui.status.dataset.status = dictionaryState === 'ready' ? status : 'empty';
    renderJokers();
  }

  /** The joker button: how many stars are left to use, and whether one is in the word. */
  function renderJokers(): void {
    const inWord = tracker.includes(HAND_JOKER);
    const left = jokers - pendingJokers() - (inWord ? 1 : 0);
    ui.jokerCount.textContent = String(left);
    ui.jokerButton.classList.toggle('empty', left === 0);
    ui.jokerButton.setAttribute('aria-pressed', String(inWord));
    ui.jokerButton.setAttribute('aria-label', `${t(settings.lang, 'useJoker')}: ${left}`);
  }

  /** The top bar: the scores, and the ring emptying with the seconds left. */
  function renderBar(remaining: number): void {
    ui.vsYouScore.textContent = String(score);
    ui.vsBotScore.textContent = String(rivalScore);
    const seconds = Math.ceil(remaining / 1000);
    ui.vsSeconds.textContent = String(seconds);
    ui.vsRingFill.style.strokeDasharray = ringDashes(remaining / ROUND_MS, settings.theme);
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
    ui.lobbyCodeInput.placeholder = t(lang, 'roomCode');
    renderRival();
    ui.langRu.textContent = __DICTIONARIES__.includes('ru')
      ? 'Русский'
      : `Русский (${t(lang, 'noDictionary')})`;
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
    (form.elements.namedItem('lang') as HTMLSelectElement).value = settings.lang;
    (form.elements.namedItem('sound') as RadioNodeList).value = settings.sound ? 'on' : 'off';
    (form.elements.namedItem('theme') as RadioNodeList).value = settings.theme;
    ui.dialog.showModal();
  }

  function applySettings(): void {
    const form = ui.dialog.querySelector('form')!;
    const lang = (form.elements.namedItem('lang') as HTMLSelectElement).value as Language;
    settings.sound = (form.elements.namedItem('sound') as RadioNodeList).value === 'on';
    sounds.enabled = settings.sound;
    settings.theme = (form.elements.namedItem('theme') as RadioNodeList).value as Theme;
    applyTheme();
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
  ui.jokerButton.addEventListener('click', useJoker);
  ui.menuClose.addEventListener('click', resumeRound);
  ui.playTimed.addEventListener('click', () => startRound('solo'));
  ui.playBot.addEventListener('click', () => startRound('bot'));
  ui.playOnline.hidden = !SERVER_URL;
  ui.playFriend.hidden = !SERVER_URL;
  ui.playOnline.addEventListener('click', () => void joinMatch({ kind: 'quick' }));
  ui.playFriend.addEventListener('click', () => openFriendLobby());
  ui.lobbyCreate.addEventListener('click', () => void joinMatch({ kind: 'create' }));
  ui.lobbyJoin.addEventListener('click', joinByCode);
  ui.lobbyCodeInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    joinByCode();
  });
  // Only the player's own Cancel or Esc leaves the match, not the game closing the lobby.
  ui.lobbyCancel.addEventListener('click', cancelLobby);
  ui.lobby.addEventListener('cancel', cancelLobby);
  ui.dialog.addEventListener('close', applySettings);
  ui.result.addEventListener('close', closeResult);
  window.addEventListener('keydown', (e) => {
    if (ui.dialog.open || ui.lobby.open || !round) return;
    if (!ui.menu.hidden) {
      if (e.key === 'Escape') resumeRound();
      return;
    }
    if (e.key === 'Enter') submitWord();
    else if (e.key === 'Escape' || e.key === 'Backspace') clearWord();
    else if (e.key === '*') useJoker();
  });

  /** Classic or 8-bit: the page's look (style.css) and the tiles' (the renderer). */
  function applyTheme(): void {
    document.documentElement.dataset.theme = settings.theme;
    game.setTheme(settings.theme);
  }

  applyTheme();
  translate();
  render();
  void loadWords();
}

/** How many blocks make up the 8-bit timer ring. */
const PIXEL_SEGMENTS = 16;

/**
 * The timer ring's stroke-dasharray (the ring's length is 100) for the share of time left: one
 * arc, or in the 8-bit style that many separate blocks.
 */
function ringDashes(left: number, theme: Theme): string {
  if (theme !== '8bit') return `${left * 100} 100`;
  const lit = Math.ceil(left * PIXEL_SEGMENTS);
  const step = 100 / PIXEL_SEGMENTS;
  return [...Array<string>(lit).fill(`${step - 2} 2`), '0 100'].join(' ');
}
