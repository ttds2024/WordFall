/**
 * The game's online side, on Supabase: the player's account, their saved rounds and the
 * leaderboard. See supabase/ for the database and the sign-in function.
 *
 * Everything here is optional. Without VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY the
 * game plays exactly as before, and the Supabase library is not even downloaded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Provider } from '../auth/auth';
import type { RoundKind } from '../core/round';
import type { Language } from '../i18n';
import { readBoard, roundArgs, type BoardRow, type RoundReport } from './rounds';

const URL = import.meta.env.VITE_SUPABASE_URL || undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined;

/** Whether the build has a Supabase project to talk to. */
export const backendEnabled = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | undefined;

function supabase(): Promise<SupabaseClient> {
  if (!URL || !KEY) return Promise.reject(new Error('Supabase is not set up'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, {
      // Yandex ID answers in the address too (#access_token=…); that one is not Supabase's.
      auth: { detectSessionInUrl: false },
    }),
  );
  return client;
}

/** Whether the player has a Supabase session on this device. */
export async function hasSession(): Promise<boolean> {
  const { data } = await (await supabase()).auth.getSession();
  return Boolean(data.session);
}

/**
 * Trades the provider's access token for a Supabase session: the provider-login function checks
 * the token with Yandex ID or VK ID and answers with a one-time token for the player's account.
 */
export async function signInBackend(provider: Provider, accessToken: string): Promise<void> {
  const db = await supabase();
  const { data, error } = await db.functions.invoke<{ token_hash?: string }>('provider-login', {
    body: { provider, access_token: accessToken },
  });
  if (error || !data?.token_hash) throw error ?? new Error('No sign-in token');
  const verified = await db.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' });
  if (verified.error) throw verified.error;
}

/** Forgets the session on this device. */
export async function signOutBackend(): Promise<void> {
  await (await supabase()).auth.signOut({ scope: 'local' });
}

/** Saves a finished round if the player is signed in; returns whether it was saved. */
export async function submitRound(report: RoundReport): Promise<boolean> {
  if (!backendEnabled || !(await hasSession())) return false;
  const { error } = await (await supabase()).rpc('submit_round', roundArgs(report));
  return !error;
}

/** The best scores in one language and mode, highest first. */
export async function fetchBoard(lang: Language, kind: RoundKind): Promise<BoardRow[]> {
  const { data, error } = await (
    await supabase()
  ).rpc('leaderboard', { p_lang: lang, p_kind: kind });
  if (error) throw error;
  return readBoard(data);
}
