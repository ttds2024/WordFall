/**
 * Signs a player in to Supabase with the Yandex ID or VK ID token the game got in the browser.
 *
 * POST { provider: 'yandex' | 'vk', access_token } → { token_hash }. The token is checked with
 * its provider; the player's account is found (or made on their first sign-in), their name and
 * avatar are saved for the leaderboard, and a one-time token_hash comes back, which the game
 * trades for a session with supabase.auth.verifyOtp().
 *
 * Secrets: YANDEX_CLIENT_ID and VK_APP_ID, the same app IDs the game is built with.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, isProvider, verifyProvider } from './providers.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return reply(405, { error: 'POST only' });

  let body: { provider?: unknown; access_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: 'JSON expected' });
  }
  const { provider, access_token: accessToken } = body;
  if (!isProvider(provider) || typeof accessToken !== 'string' || !accessToken) {
    return reply(400, { error: 'provider and access_token are required' });
  }

  let identity;
  try {
    identity = await verifyProvider(provider, accessToken, {
      yandexClientId: Deno.env.get('YANDEX_CLIENT_ID') || undefined,
      vkAppId: Deno.env.get('VK_APP_ID') || undefined,
    });
  } catch (error) {
    return reply(401, { error: error instanceof Error ? error.message : 'token refused' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = accountEmail(identity);

  // First sign-in makes the account; later ones find it already there.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { provider: identity.provider, provider_id: identity.id },
  });
  if (created.error && created.error.code !== 'email_exists') {
    console.error('createUser', created.error);
    return reply(500, { error: 'could not create the account' });
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error || !link.data.user || !link.data.properties?.hashed_token) {
    console.error('generateLink', link.error);
    return reply(500, { error: 'could not sign in' });
  }

  const saved = await admin.from('profiles').upsert({
    id: link.data.user.id,
    provider: identity.provider,
    name: identity.name,
    avatar: identity.avatar ?? null,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) {
    console.error('profiles', saved.error);
    return reply(500, { error: 'could not save the profile' });
  }

  return reply(200, { token_hash: link.data.properties.hashed_token });
});
