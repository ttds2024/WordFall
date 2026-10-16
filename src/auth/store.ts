import type { PendingLogin, Profile, Provider } from './auth';

const PROFILE_KEY = 'wordfall.profile';
const PENDING_KEY = 'wordfall.pendingLogin';
const PROVIDERS: readonly Provider[] = ['yandex', 'vk'];

/** Where sign-in state lives: the profile across visits, the pending login for this tab only. */
export interface AuthStorage {
  local: Storage | undefined;
  session: Storage | undefined;
}

function read(storage: Storage | undefined, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    if (value === undefined) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); sign-in then lasts for this visit only.
  }
}

function isProvider(value: unknown): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

export function loadProfile(storage: AuthStorage): Profile | undefined {
  const p = read(storage.local, PROFILE_KEY) as Partial<Profile> | null;
  if (!p || !isProvider(p.provider) || typeof p.name !== 'string') return undefined;
  return {
    provider: p.provider,
    name: p.name,
    avatar: typeof p.avatar === 'string' ? p.avatar : undefined,
  };
}

export function saveProfile(storage: AuthStorage, profile: Profile | undefined): void {
  write(storage.local, PROFILE_KEY, profile);
}

/** Reads and forgets the pending login: an answer from the provider can be used only once. */
export function takePending(storage: AuthStorage): PendingLogin | undefined {
  const p = read(storage.session, PENDING_KEY) as Partial<PendingLogin> | null;
  write(storage.session, PENDING_KEY, undefined);
  if (!p || !isProvider(p.provider) || typeof p.state !== 'string') return undefined;
  return {
    provider: p.provider,
    state: p.state,
    codeVerifier: typeof p.codeVerifier === 'string' ? p.codeVerifier : undefined,
  };
}

export function savePending(storage: AuthStorage, pending: PendingLogin): void {
  write(storage.session, PENDING_KEY, pending);
}
