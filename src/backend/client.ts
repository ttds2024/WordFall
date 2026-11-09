/**
 * The game's online side, on Supabase: saved rounds and the leaderboard. See supabase/ for the
 * database. Players are guests, known by a secret token their browser keeps (guest.ts); there is
 * no sign-in.
 *
 * Everything here is optional. Without VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY the
 * game plays exactly as before, and the Supabase library is not even downloaded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Language } from '../i18n';
import type { Guest } from './guest';
import { channelName, Match, readMessage, type MatchEvents } from './match';
import { readBoard, roundArgs, type BoardKind, type BoardRow, type RoundReport } from './rounds';

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
  kind: BoardKind,
  guest: Guest,
): Promise<BoardRow[]> {
  const { data, error } = await (
    await supabase()
  ).rpc('leaderboard', { p_lang: lang, p_kind: kind, p_token: guest.token });
  if (error) throw error;
  return readBoard(data);
}

/**
 * Connects a match (see match.ts) to its channel: a Supabase Realtime broadcast channel named
 * after the code, which carries each player's messages to the other and keeps nothing. The match
 * reports through its events, also when the connection cannot be made.
 */
export async function connectMatch(
  code: string,
  role: 'host' | 'guest',
  name: string,
  events: MatchEvents,
): Promise<Match> {
  const db = await supabase();
  const channel = db.channel(channelName(code), { config: { broadcast: { self: false } } });
  const match = new Match(
    code,
    role,
    name,
    {
      send: (message) => void channel.send({ type: 'broadcast', event: 'match', payload: message }),
      close: () => void db.removeChannel(channel),
    },
    events,
  );
  channel.on('broadcast', { event: 'match' }, ({ payload }) => {
    const message = readMessage(payload);
    if (message) match.receive(message);
  });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') match.open();
    // Before the round starts a broken connection ends the match; after, the library reconnects.
    else if (status !== 'CLOSED' && !match.started) match.fail('failed');
  });
  return match;
}
