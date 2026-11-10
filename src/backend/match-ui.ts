import { t, type Language, type StringKey } from '../i18n';
import { backendEnabled, connectMatch } from './client';
import {
  CODE_LENGTH,
  newCode,
  readCode,
  type Match,
  type MatchError,
  type MatchStart,
} from './match';

function element<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

const ERROR_TEXT: Record<MatchError, StringKey> = {
  notFound: 'matchNotFound',
  full: 'matchFull',
  failed: 'matchFailed',
};

export interface MatchHandlers {
  language(): Language;
  /** The name the other player sees. */
  name(): string;
  /** Both players are here: the round starts in start.delay ms. */
  start(match: Match, opponentName: string, start: MatchStart): void;
  score(score: number): void;
  final(score: number): void;
  left(): void;
}

/**
 * "Play vs friend" on the start menu (hidden without a backend) and its window: create a match
 * and show its code, or join one with a code. A link with ?match=CODE opens the window with the
 * code filled in. Returns open(), for "Play again" after a match.
 */
export function setupMatch(handlers: MatchHandlers): { open(): void } {
  const ui = {
    play: element<HTMLButtonElement>('#play-friend'),
    dialog: element<HTMLDialogElement>('#match'),
    choose: element('#match-choose'),
    create: element<HTMLButtonElement>('#match-create'),
    input: element<HTMLInputElement>('#match-code-input'),
    join: element<HTMLButtonElement>('#match-join'),
    waiting: element('#match-waiting'),
    code: element('#match-code'),
    copy: element<HTMLButtonElement>('#match-copy'),
    note: element('#match-note'),
  };
  ui.play.hidden = !backendEnabled;
  if (!backendEnabled) return { open() {} };

  type State = 'choose' | 'hosting' | 'joining';
  let state: State = 'choose';
  /** The match being set up; once it starts it is the game's. */
  let pending: Match | undefined;
  let note: StringKey | undefined;
  /** Only the latest attempt counts, if the player cancels and tries again quickly. */
  let attempt = 0;

  function render(): void {
    const lang = handlers.language();
    ui.choose.hidden = state === 'hosting';
    ui.waiting.hidden = state !== 'hosting';
    ui.create.disabled = ui.join.disabled = ui.input.disabled = state === 'joining';
    ui.code.textContent = pending?.code ?? '';
    const shown = state === 'joining' ? 'matchJoining' : note;
    ui.note.textContent = shown ? t(lang, shown) : '';
    ui.note.hidden = !shown;
  }

  function reset(next?: StringKey): void {
    attempt++;
    pending?.leave();
    pending = undefined;
    state = 'choose';
    note = next;
    render();
  }

  async function begin(role: 'host' | 'guest', code: string): Promise<void> {
    const token = ++attempt;
    state = role === 'host' ? 'hosting' : 'joining';
    note = undefined;
    render();
    try {
      const match = await connectMatch(code, role, handlers.name(), {
        onStart(opponentName, start) {
          pending = undefined;
          state = 'choose';
          ui.dialog.close();
          handlers.start(match, opponentName, start);
        },
        onScore: handlers.score,
        onFinal: handlers.final,
        onLeft: handlers.left,
        onError(error) {
          if (pending === match) pending = undefined;
          if (token === attempt) reset(ERROR_TEXT[error]);
        },
      });
      if (token !== attempt) {
        match.leave();
        return;
      }
      pending = match;
      render();
    } catch {
      if (token === attempt) reset('matchFailed');
    }
  }

  function open(code = ''): void {
    reset();
    ui.input.value = code;
    if (!ui.dialog.open) ui.dialog.showModal();
  }

  ui.input.maxLength = CODE_LENGTH + 2;
  ui.play.addEventListener('click', () => open());
  ui.create.addEventListener('click', () => void begin('host', newCode()));
  ui.join.addEventListener('click', () => {
    const code = readCode(ui.input.value);
    if (code) void begin('guest', code);
    else reset('matchBadCode');
  });
  ui.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    ui.join.click();
  });
  ui.copy.addEventListener('click', () => {
    if (!pending) return;
    const link = new URL(location.origin + location.pathname);
    link.searchParams.set('match', pending.code);
    navigator.clipboard?.writeText(link.toString()).then(
      () => {
        note = 'matchCopied';
        render();
      },
      () => {},
    );
  });
  // Closing the window (Cancel, Esc) drops a match that has not started.
  ui.dialog.addEventListener('close', () => reset());

  // A friend's link: open the window with their code, and take it out of the address.
  const url = new URL(location.href);
  const linked = readCode(url.searchParams.get('match') ?? '');
  if (url.searchParams.has('match')) {
    url.searchParams.delete('match');
    history.replaceState(history.state, '', url);
  }
  if (linked) open(linked);

  return { open: () => open() };
}
