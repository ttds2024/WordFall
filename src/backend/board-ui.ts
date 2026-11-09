import { t, type Language } from '../i18n';
import { backendEnabled, fetchBoard } from './client';
import { cleanName, MAX_NAME, type Guest } from './guest';
import type { BoardKind, BoardRow } from './rounds';

function element<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

type State = 'loading' | 'failed' | BoardRow[];

/**
 * The leaderboard: a button on the start menu (hidden without a backend) and the window it opens,
 * with the best scores in the game's language, on your own or against the bot, and the name this
 * player's scores are saved under. rename() is called when the player changes that name.
 */
export function setupBoard(
  language: () => Language,
  guest: () => Guest,
  rename: (name: string) => void,
): void {
  const ui = {
    open: element<HTMLButtonElement>('#menu-board'),
    dialog: element<HTMLDialogElement>('#board'),
    tabs: {
      solo: element<HTMLButtonElement>('#board-solo'),
      bot: element<HTMLButtonElement>('#board-bot'),
    } satisfies Record<BoardKind, HTMLButtonElement>,
    rows: element<HTMLOListElement>('#board-rows'),
    note: element('#board-note'),
    name: element<HTMLInputElement>('#board-name'),
  };
  ui.open.hidden = !backendEnabled;
  if (!backendEnabled) return;

  let kind: BoardKind = 'solo';
  let state: State = 'loading';
  /** Only the latest request's answer is shown. */
  let request = 0;

  function render(): void {
    for (const tab of ['solo', 'bot'] as const) {
      ui.tabs[tab].setAttribute('aria-selected', String(tab === kind));
    }
    const rows = Array.isArray(state) ? state : [];
    ui.rows.replaceChildren(...rows.map(rowElement));
    ui.rows.hidden = rows.length === 0;
    const note =
      state === 'loading'
        ? 'boardLoading'
        : state === 'failed'
          ? 'boardFailed'
          : rows.length === 0
            ? 'boardEmpty'
            : undefined;
    ui.note.textContent = note ? t(language(), note) : '';
    ui.note.hidden = !note;
  }

  async function load(): Promise<void> {
    const token = ++request;
    state = 'loading';
    render();
    let loaded: State;
    try {
      loaded = await fetchBoard(language(), kind, guest());
    } catch {
      loaded = 'failed';
    }
    if (token !== request) return;
    state = loaded;
    render();
  }

  ui.name.maxLength = MAX_NAME;
  // An emptied name goes back to what it was.
  ui.name.addEventListener('change', () => {
    const name = cleanName(ui.name.value);
    if (name) rename(name);
    ui.name.value = guest().name;
  });
  ui.open.addEventListener('click', () => {
    ui.name.value = guest().name;
    ui.dialog.showModal();
    void load();
  });
  for (const tab of ['solo', 'bot'] as const) {
    ui.tabs[tab].addEventListener('click', () => {
      if (tab === kind) return;
      kind = tab;
      void load();
    });
  }
}

/** One line: the place, the name's first letter, the name and the score. */
function rowElement(row: BoardRow): HTMLLIElement {
  const li = document.createElement('li');
  li.className = row.me ? 'board-row me' : 'board-row';
  const rank = document.createElement('span');
  rank.className = 'board-rank';
  rank.textContent = String(row.rank);
  const picture = document.createElement('span');
  picture.className = 'board-avatar';
  picture.textContent = row.name.charAt(0).toUpperCase();
  const name = document.createElement('span');
  name.className = 'board-name';
  name.textContent = row.name;
  const score = document.createElement('b');
  score.className = 'board-score';
  score.textContent = String(row.score);
  li.append(rank, picture, name, score);
  return li;
}
