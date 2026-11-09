/**
 * The game's online side, on Supabase: saved rounds and the leaderboard. See supabase/ for the
 * database. Players are guests, known by a secret token their browser keeps (guest.ts); there is
 * no sign-in.
 *
 * Everything here is optional. Without VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY the
 * game plays exactly as before, and the Supabase library is not even downloaded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoundKind } from '../core/round';
import type { Language } from '../i18n';
import type { Guest } from './guest';
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
      // No Supabase accounts: nothing to keep, refresh or read from the address.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
  return client;
}

/** Saves a finished round for this guest; returns whether it was saved. */
export async function submitRound(guest: Guest, report: RoundReport): Promise<boolean> {
  if (!backendEnabled) return false;
  const { error } = await (await supabase()).rpc('submit_round', roundArgs(guest, report));
  return !error;
}

/** The best scores in one language and mode, highest first, with this guest's line marked. */
export async function fetchBoard(
  lang: Language,
  kind: RoundKind,
  guest: Guest,
): Promise<BoardRow[]> {
  const { data, error } = await (
    await supabase()
  ).rpc('leaderboard', { p_lang: lang, p_kind: kind, p_token: guest.token });
  if (error) throw error;
  return readBoard(data);
}
