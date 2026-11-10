import { setupAuth } from './auth/ui';
import { setupBoard } from './backend/board-ui';
import { submitRound } from './backend/client';
import { defaultName, loadGuest, saveGuest } from './backend/guest';
import { outcome, type Match, type MatchStart } from './backend/match';
import { setupMatch } from './backend/match-ui';
import type { FoundWord } from './backend/rounds';
import { BOT_ACCURACY, BOT_THINK_MS, BotClock, findWord, pickMiss } from './core/bot';
import { Dictionary } from './core/dictionary';
import { ROUND_MS, RoundTimer, type RoundKind } from './core/round';
import { scoreWord, wordMultiplier } from './core/scoring';
import { JOKER } from './core/word';
import { WordTracker, type SubmitResult, type WordStatus } from './core/word-tracker';
import { Game } from './game/game';
import { MatchConnection, serverUrl } from './net/match';
import { normalizeCode, ROOM_CODE, type ServerMessage } from './net/protocol';
import { bumpScore, floatPosition, pointsText, showScoreFloat } from './score-float';
import type { Tile } from './game/physics';
import { t, type Language, type StringKey } from './i18n';
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

/** After our time is up, how long to wait for a friend's final score before settling without it. */
const RIVAL_WAIT_MS = 10_000;

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
    vsBotLabel: element('#vs-bot-label'),
    vsRivalInitial: element('#vs-rival-initial'),
    resultBotLabel: element('#result-bot-label'),
    resultAgain: element<HTMLButtonElement>('#result-again'),
    jokerButton: element<HTMLButtonElement>('#joker-button'),
    jokerCount: element('#joker-count'),
    vsRing: element('#vs-ring'),
    vsRingFill: element('#vs-ring-fill'),
    vsSeconds: element('#vs-seconds'),
    resultBot: element('#result-bot'),
    resultBotBox: element('#result-bot-box'),
    playOnline: element<HTMLButtonElement>('#play-online'),
    online: element<HTMLDialogElement>('#online'),
    onlineChoose: element('#online-choose'),
    onlineQuick: element<HTMLButtonElement>('#online-quick'),
    onlineCreate: element<HTMLButtonElement>('#online-create'),
    onlineJoin: element<HTMLButtonElement>('#online-join'),
    onlineCode: element<HTMLInputElement>('#online-code'),
    onlineStatus: element('#online-status'),
    onlineRoom: element('#online-room'),
    fieldWrap: element('.field-wrap'),
    menu: element('#menu'),
    result: element<HTMLDialogElement>('#result'),
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
    langRu: element<HTMLOptionElement>('#lang-ru'),
  };

  const tracker = new WordTracker<WordItem>(undefined);
  const sounds = new Sounds();
  sounds.enabled = settings.sound;
  const auth = setupAuth(() => settings.lang);
  // Online the player is a guest, known by a secret token this browser keeps.
  const guest = loadGuest(storage, () => defaultName(t(settings.lang, 'guest')));
  setupBoard(
    () => settings.lang,
    () => guest,
    (name) => {
      guest.name = name;
      saveGuest(storage, guest);
    },
  );
  let dictionaryState: DictionaryState = 'loading';
  let loadToken = 0;
  let score = 0;
  /** The words the player scored this round, for the saved round. */
  let found: FoundWord[] = [];
  /** Stars collected this round and not spent yet (one may be in the word being built). */
  let jokers = 0;
  let toastTimer = 0;
  let round: RoundTimer | undefined;
  /** The kind of the last round started, for "Play again". */
  let lastKind: RoundKind = 'solo';
  /** The finished round the result window is showing. */
  let result: { kind: RoundKind; timeUp: boolean; title?: string } | undefined;
  let dictionary: Dictionary | undefined;
  // The other side's score: the bot's, or the friend's in a match.
  let rivalScore = 0;
  // A match against a friend: the connection, their name, and how their round ended (their time
  // ran out, they left, or nothing was heard of them for too long after ours).
  let match: Match | undefined;
  let rivalName = '';
  let rivalDone: 'final' | 'left' | 'silent' | undefined;
  let rivalTimer = 0;
  /** Holds the field back until a match's round starts, at the same moment for both players. */
  let startTimer = 0;
  const matchUi = setupMatch({
    language: () => settings.lang,
    name: () => guest.name,
    start(started, opponentName, start) {
      match = started;
      rivalName = opponentName || t(settings.lang, 'friend');
      startRound('match', start);
    },
    // Once the friend's round is over their score stands.
    score(points) {
      if (rivalDone) return;
      rivalScore = points;
      renderResult();
    },
    final(points) {
      if (rivalDone) return;
      rivalScore = points;
      settleRival('final');
    },
    left() {
      if (round) showToast(t(settings.lang, 'friendLeft'), 'bad');
      settleRival('left');
    },
  });
  // The bot, when playing against one: when it next tries, and the try in progress.
  let botClock: BotClock | undefined;
  let botTry: { tiles: Tile[]; correct: boolean; word: string; wait: number } | undefined;
  // Online on a shared field: the connection to the server (the other player's name and score are
  // rivalName and rivalScore), the
  // word claim waiting for the server's answer, and the picks last shown to the other player.
  const onlineUrl = serverUrl();
  let server: MatchConnection | undefined;
  let pendingClaim: number | undefined;
  let claimId = 0;
  let sentPicks = '';

  const game = new Game(element<HTMLCanvasElement>('#field'), settings.lang, {
    onTap(tile) {
      // Bombs carry no letter; they only explode. Letters the bot has picked are its own; online
      // the other player's picks are fair game, whoever claims the word first gets them.
      if (tile.kind === 'bomb' || (tile.bot && round?.kind !== 'pvp')) return;
      // Online, the word sent to the server stays as it is until the server answers.
      if (pendingClaim !== undefined) return;
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
      // Online the server ends the round, and says who won.
      if (round.advance(elapsed) && round.kind !== 'pvp') {
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
      const multiplier = wordMultiplier(result.items);
      const points = scoreWord(result.word) * multiplier;
      score += points;
      match?.sendScore(score);
      found.push({ word: result.word, multiplier });
      // A joker from the stock is spent once its word scores.
      if (result.items.includes(HAND_JOKER)) jokers--;
      const tiles = result.items.filter(isTile);
      // The word and its points rise from where its tiles were.
      const at = floatPosition(
        tiles.map((tile) => tile.body.position),
        ui.fieldWrap.clientWidth,
        ui.fieldWrap.clientHeight,
      );
      game.removeTiles(tiles);
      showScoreFloat(ui.fieldWrap, at, pointsText(points), result.word);
      sounds.play('success');
      bumpScore(ui.vsYouScore);
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

  /** Whether the other side of a round of this kind is a person, shown by name and initial. */
  function versusPlayer(kind: RoundKind): boolean {
    return kind === 'match' || kind === 'pvp';
  }

  function stopBot(): void {
    for (const tile of botTry?.tiles ?? []) tile.bot = false;
    botTry = undefined;
  }

  /**
   * Starts a round. Against another player the round is the same for both: it drops the tiles
   * start.seed gives, starts after start.delay, and runs on the clock rather than on play time.
   */
  function startRound(kind: RoundKind, start?: MatchStart): void {
    // Any other round ends a game against a player that is still open.
    if (kind !== 'pvp') leaveServer();
    if (kind !== 'match') closeMatch(true);
    window.clearTimeout(rivalTimer);
    window.clearTimeout(startTimer);
    rivalDone = undefined;
    lastKind = kind;
    round = start ? new RoundTimer(kind, Date.now, start.delay) : new RoundTimer(kind);
    score = 0;
    found = [];
    jokers = START_JOKERS;
    stopBot();
    rivalScore = 0;
    botClock = kind === 'bot' ? new BotClock() : undefined;
    // Against the bot or a friend the top bar also shows their score, under their name.
    document.getElementById('app')!.dataset.mode = kind;
    ui.vsBotLabel.textContent = versusPlayer(kind) ? rivalName : t(settings.lang, 'bot');
    ui.vsRivalInitial.textContent = rivalName.charAt(0).toUpperCase();
    ui.vsAvatar.textContent = (auth.name() ?? t(settings.lang, 'you')).charAt(0).toUpperCase();
    pendingClaim = undefined;
    sentPicks = '';
    tracker.reset();
    game.stop();
    game.reset(settings.lang, start?.seed);
    ui.menuClose.hidden = true;
    ui.menu.hidden = true;
    render();
    if (start && start.delay > 0) startTimer = window.setTimeout(() => game.start(), start.delay);
    else game.start();
  }

  /**
   * A match's time runs out on the clock even while the game is not drawing (the tab is in the
   * background), so the friend is not left waiting for this player's final score.
   */
  function checkMatchClock(): void {
    if (round?.kind === 'match' && round.advance(0)) endRound();
  }

  /** ☰ during a round: pauses it (timer and bot included) and opens the menu, with ✕ to resume. */
  function pauseRound(): void {
    if (!round) return;
    // A match cannot wait: ☰ leaves it, and the friend is told.
    if (match) {
      closeMatch(true);
      dropRound();
      game.stop();
      ui.menu.hidden = false;
      return;
    }
    // An online round cannot wait either: it goes on behind the menu.
    if (round.kind !== 'pvp') game.stop();
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
    leaveServer();
    round = undefined;
    stopBot();
    clearWord();
    ui.menuClose.hidden = true;
  }

  /**
   * Stops play and shows the result in its own window, over the start menu. Online, `title` is
   * set from the server's verdict.
   */
  function endRound(title?: string): void {
    if (!round) return;
    const timeUp = round.over;
    round = undefined;
    ui.menuClose.hidden = true;
    game.stop();
    stopBot();
    clearWord();
    if (match) {
      match.sendFinal(score);
      // If the friend's own time is not up yet, wait a little for their final score.
      if (!rivalDone) rivalTimer = window.setTimeout(() => settleRival('silent'), RIVAL_WAIT_MS);
      else closeMatch(false);
    }
    result = { kind: lastKind, timeUp, title };
    renderResult();
    ui.menu.hidden = false;
    ui.result.showModal();
    // The round goes to the leaderboard (not one against a player); if that fails the game just
    // goes on.
    if (timeUp && lastKind !== 'match' && lastKind !== 'pvp') {
      const report = { kind: lastKind, lang: settings.lang, words: found, botScore: rivalScore };
      submitRound(guest, report).catch(() => {});
    }
  }

  /**
   * The result window's words: against the bot or a friend, who won (or that the friend is still
   * playing, or left); otherwise whether time ran out. A friend's score can still change.
   */
  function renderResult(): void {
    if (!result) return;
    const lang = settings.lang;
    let title = '';
    if (result.title) {
      title = result.title;
    } else if (result.kind === 'match') {
      const won = { win: 'youWin', loss: 'friendWins', draw: 'draw' } as const;
      title = !rivalDone
        ? t(lang, 'matchWaitingResult')
        : rivalDone === 'left'
          ? t(lang, 'friendLeft')
          : t(lang, won[outcome(score, rivalScore)]);
    } else if (result.kind === 'bot') {
      title = t(lang, score > rivalScore ? 'youWin' : score < rivalScore ? 'botWins' : 'draw');
    } else if (result.timeUp) {
      title = t(lang, 'timeUp');
    }
    ui.resultTitle.textContent = title;
    ui.resultTitle.hidden = !title;
    ui.resultScore.textContent = String(score);
    ui.resultBot.textContent = String(rivalScore);
    ui.resultBotLabel.textContent = versusPlayer(result.kind) ? rivalName : t(lang, 'bot');
    ui.resultBotBox.hidden = result.kind === 'solo';
    ui.resultAgain.textContent = t(lang, result.kind === 'match' ? 'newMatch' : 'playAgain');
  }

  /** The friend's round is over, one way or another; once ours is too, so is the match. */
  function settleRival(how: 'final' | 'left' | 'silent'): void {
    if (rivalDone) return;
    rivalDone = how;
    window.clearTimeout(rivalTimer);
    if (!round) closeMatch(false);
    renderResult();
  }

  /** Hangs up the match, telling the friend if we are walking out on it. */
  function closeMatch(leaving: boolean): void {
    window.clearTimeout(rivalTimer);
    window.clearTimeout(startTimer);
    if (leaving) match?.leave();
    else match?.close();
    match = undefined;
  }

  /** Closing the result: "Play again" starts the same kind of round; otherwise the menu stays. */
  function closeResult(): void {
    const again = ui.result.returnValue === 'again';
    ui.result.returnValue = '';
    // Closed while still waiting for the friend's final score: the match is over for us.
    closeMatch(true);
    result = undefined;
    if (!again) return;
    // A new match needs a new code; any other round just starts again.
    if (lastKind === 'match') matchUi.open();
    else if (lastKind === 'pvp') openOnline();
    else startRound(lastKind);
  }

  /** A tapped star leaves the field and joins the player's stock; with a full stock it stays. */
  function collectJoker(tile: Tile): void {
    if (jokers >= MAX_JOKERS) {
      showToast(t(settings.lang, 'jokersFull'), 'bad');
      return;
    }
    // Online the server hands out stars, so both players cannot take the same one.
    if (round?.kind === 'pvp') {
      server?.send({ type: 'star', tile: tile.seq });
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
    if (jokers === 0) {
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
    if (round?.kind === 'pvp') {
      claimWord();
      return;
    }
    handleResult(tracker.submit());
    render();
  }

  /** Online: a word checked here goes to the server, which scores it unless the other player was first. */
  function claimWord(): void {
    const status = tracker.status();
    if (pendingClaim !== undefined || status === 'empty') return;
    const resolved = tracker.resolved;
    if (status !== 'valid' || !resolved) {
      showToast(t(settings.lang, STATUS_TEXT[status]), 'bad');
      return;
    }
    pendingClaim = ++claimId;
    server?.send({
      type: 'word',
      id: pendingClaim,
      tiles: tracker.items.map((item) => (isTile(item) ? item.seq : null)),
      word: resolved,
    });
  }

  /** Online: tells the other player which tiles are in the word being built, when they change. */
  function sendPicks(): void {
    if (round?.kind !== 'pvp' || !server) return;
    const tiles = tracker.items.filter(isTile).map((tile) => tile.seq);
    const key = tiles.join(',');
    if (key === sentPicks) return;
    sentPicks = key;
    server.send({ type: 'pick', tiles });
  }

  /** "Play vs player": the window to find a match or share a room. */
  function openOnline(): void {
    if (!onlineUrl) return;
    leaveServer();
    showLobby('');
    ui.onlineCode.value = '';
    ui.online.showModal();
  }

  /** The lobby window: the choices, or (while connecting or waiting) a status line. */
  function showLobby(status: string, choosing = true, code?: string): void {
    ui.onlineChoose.hidden = !choosing;
    ui.onlineStatus.textContent = status;
    ui.onlineRoom.textContent = code ?? '';
    ui.onlineRoom.hidden = !code;
  }

  function connect(): MatchConnection | undefined {
    leaveServer();
    if (!onlineUrl) return undefined;
    showLobby(t(settings.lang, 'connecting'), false);
    const connection = new MatchConnection(onlineUrl, {
      onMessage: (message) => {
        if (server === connection) handleServer(message);
      },
      onClose: () => {
        if (server !== connection) return;
        server = undefined;
        if (round?.kind === 'pvp') endRound(t(settings.lang, 'connectionLost'));
        else showLobby(t(settings.lang, 'offline'));
      },
    });
    server = connection;
    return connection;
  }

  function playerName(): string {
    return auth.name() ?? t(settings.lang, 'player');
  }

  function quickMatch(): void {
    connect()?.send({ type: 'quick', lang: settings.lang, name: playerName() });
  }

  function createRoom(): void {
    connect()?.send({ type: 'create', lang: settings.lang, name: playerName() });
  }

  function joinRoom(): void {
    const code = normalizeCode(ui.onlineCode.value);
    if (!ROOM_CODE.test(code)) {
      showLobby(t(settings.lang, 'noRoom'));
      return;
    }
    connect()?.send({ type: 'join', code, lang: settings.lang, name: playerName() });
  }

  /** Closes the connection, if any; the server counts it as leaving the match. */
  function leaveServer(): void {
    const connection = server;
    server = undefined;
    connection?.close();
    pendingClaim = undefined;
  }

  /** The lobby window closed: without a match starting, that means giving up on it. */
  function closeOnline(): void {
    if (ui.online.returnValue !== 'started') leaveServer();
    ui.online.returnValue = '';
  }

  function handleServer(message: ServerMessage): void {
    switch (message.type) {
      case 'waiting':
        showLobby(t(settings.lang, 'searching'), false);
        break;
      case 'room':
        showLobby(t(settings.lang, 'roomOpen'), false, message.code);
        break;
      case 'error':
        leaveServer();
        showLobby(
          t(
            settings.lang,
            message.reason === 'noRoom'
              ? 'noRoom'
              : message.reason === 'language'
                ? 'roomLanguage'
                : 'offline',
          ),
        );
        break;
      case 'start':
        rivalName = message.opponent || t(settings.lang, 'opponent');
        if (ui.online.open) ui.online.close('started');
        ui.result.close();
        startRound('pvp', { seed: message.seed, delay: 0 });
        jokers = message.stars;
        render();
        break;
      case 'pick': {
        const picked = new Set(message.tiles);
        for (const tile of game.tiles()) tile.bot = picked.has(tile.seq);
        break;
      }
      case 'star':
        jokers = message.stars;
        game.removeTiles(game.tilesBySeq([message.tile]));
        if (message.by === 'you') {
          sounds.play('clicked');
          bumpScore(ui.jokerButton);
        }
        render();
        break;
      case 'claimed':
        onClaimed(message);
        break;
      case 'rejected':
        if (message.id !== undefined) {
          if (message.id !== pendingClaim) break;
          pendingClaim = undefined;
        }
        showToast(
          t(
            settings.lang,
            message.reason === 'taken'
              ? 'tooSlow'
              : message.reason === 'used'
                ? 'statusUsed'
                : message.reason === 'full'
                  ? 'jokersFull'
                  : 'statusUnknown',
          ),
          'bad',
        );
        render();
        break;
      case 'end': {
        score = message.you;
        rivalScore = message.opponent;
        const key =
          message.reason === 'left'
            ? 'opponentLeft'
            : score > rivalScore
              ? 'youWin'
              : score < rivalScore
                ? 'opponentWins'
                : 'draw';
        leaveServer();
        endRound(t(settings.lang, key));
        break;
      }
    }
  }

  /** A word scored online, by either player: its tiles leave both fields. */
  function onClaimed(message: Extract<ServerMessage, { type: 'claimed' }>): void {
    const tiles = game.tilesBySeq(message.tiles);
    const at = floatPosition(
      tiles.map((tile) => tile.body.position),
      ui.fieldWrap.clientWidth,
      ui.fieldWrap.clientHeight,
    );
    tracker.markUsed(message.word);
    score = message.you;
    rivalScore = message.opponent;
    jokers = message.stars;
    const word = message.word.toUpperCase();
    if (message.by === 'you') {
      if (message.id === pendingClaim) pendingClaim = undefined;
      clearWord();
      showScoreFloat(ui.fieldWrap, at, pointsText(message.points), word);
      sounds.play('success');
      bumpScore(ui.vsYouScore);
    } else {
      // Their letters leave the word being built here.
      for (const tile of tiles) tile.selected = false;
      tracker.remove(tiles);
      showScoreFloat(ui.fieldWrap, at, `${rivalName} ${pointsText(message.points)}`, word, 'bot');
      bumpScore(ui.vsBotScore);
    }
    game.removeTiles(tiles);
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
    const remaining = round?.remaining;
    if (remaining !== undefined) renderBar(remaining);
    ui.word.textContent = tracker.word;
    const multiplier = wordMultiplier(tracker.items);
    ui.multiplier.textContent = `×${multiplier}`;
    ui.multiplier.hidden = multiplier === 1;
    ui.status.textContent = statusText(status);
    ui.status.dataset.status = dictionaryState === 'ready' ? status : 'empty';
    renderJokers();
    sendPicks();
  }

  /** The joker button: how many stars are left to use, and whether one is in the word. */
  function renderJokers(): void {
    const inWord = tracker.includes(HAND_JOKER);
    const left = jokers - (inWord ? 1 : 0);
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
    ui.onlineCode.placeholder = t(lang, 'roomCodePlaceholder');
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
  ui.playOnline.hidden = !onlineUrl;
  ui.playOnline.addEventListener('click', openOnline);
  ui.onlineQuick.addEventListener('click', quickMatch);
  ui.onlineCreate.addEventListener('click', createRoom);
  ui.onlineJoin.addEventListener('click', joinRoom);
  ui.onlineCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinRoom();
    }
  });
  ui.online.addEventListener('close', closeOnline);
  ui.dialog.addEventListener('close', applySettings);
  ui.result.addEventListener('close', closeResult);
  // Leaving the page leaves the match.
  window.addEventListener('pagehide', () => closeMatch(true));
  window.setInterval(checkMatchClock, 500);
  document.addEventListener('visibilitychange', checkMatchClock);
  window.addEventListener('keydown', (e) => {
    // An open window (settings, the leaderboard) has the keyboard.
    if (document.querySelector('dialog[open]') || !round) return;
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
