/**
 * The guest this browser plays as online. There are no accounts: the browser makes itself a long
 * random secret token, keeps it, and sends it with its rounds. Whoever holds the token is that
 * player, so it never leaves this module except to the backend.
 */

const KEY = 'wordfall.guest';
export const MAX_NAME = 24;

export interface Guest {
  /** The secret that makes this browser this player: 43 URL-safe characters (256 bits). */
  token: string;
  /** The name the leaderboard shows. */
  name: string;
}

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A name as the leaderboard takes it: one line, at most 24 characters; empty if nothing is left. */
export function cleanName(name: string): string {
  return [...name.replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('').trim();
}

/** "Guest 4821": what a new guest is called until they choose a name. */
export function defaultName(word: string, random: () => number = Math.random): string {
  return `${word} ${1000 + Math.floor(random() * 9000)}`;
}

/**
 * This browser's guest; the first call makes one (named by makeName) and remembers it. Without
 * storage (private mode) the guest lasts for this visit only.
 */
export function loadGuest(storage: Storage | undefined, makeName: () => string): Guest {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<Guest> | null;
    if (saved && typeof saved.token === 'string' && TOKEN.test(saved.token)) {
      const name = typeof saved.name === 'string' ? cleanName(saved.name) : '';
      return { token: saved.token, name: name || makeName() };
    }
  } catch {
    // Unreadable: start again as a new guest.
  }
  const guest = { token: newToken(), name: cleanName(makeName()) };
  saveGuest(storage, guest);
  return guest;
}

export function saveGuest(storage: Storage | undefined, guest: Guest): void {
  try {
    storage?.setItem(KEY, JSON.stringify(guest));
  } catch {
    // Storage can be unavailable (private mode); the guest then lasts for this visit only.
  }
}
