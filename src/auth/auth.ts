/**
 * Sign-in with Yandex ID and VK ID, entirely in the browser (the game has no server).
 *
 * Yandex ID uses the OAuth implicit flow: the token comes back in the URL fragment and is used
 * once to read the player's name and avatar. VK ID uses OAuth 2.1 with PKCE: the code comes back
 * in the query string and is exchanged for a token without a client secret. Tokens are never
 * stored; only the profile is kept, so signing out just forgets it.
 *
 * Sber ID is not here: it needs a client secret and a TLS client certificate, so it needs a server.
 */

export type Provider = 'yandex' | 'vk';

/** App IDs registered with each provider; public values, set at build time. */
export interface AuthConfig {
  yandexClientId?: string;
  vkAppId?: string;
}

/** Who is signed in. */
export interface Profile {
  provider: Provider;
  name: string;
  avatar?: string;
}

/** Remembered between leaving for the provider's page and coming back. */
export interface PendingLogin {
  provider: Provider;
  state: string;
  codeVerifier?: string;
}

type Fetch = typeof fetch;

const YANDEX_AUTHORIZE = 'https://oauth.yandex.ru/authorize';
const YANDEX_INFO = 'https://login.yandex.ru/info?format=json';
const VK_ID = 'https://id.vk.ru';

export function enabledProviders(config: AuthConfig): Provider[] {
  const providers: Provider[] = [];
  if (config.yandexClientId) providers.push('yandex');
  if (config.vkAppId) providers.push('vk');
  return providers;
}

/** The address the provider sends the player back to: this page, without query or fragment. */
export function redirectUri(location: { origin: string; pathname: string }): string {
  return location.origin + location.pathname;
}

/** A random URL-safe string (PKCE code verifiers allow 43 to 128 characters). */
export function randomString(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** PKCE S256 code challenge for a code verifier. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds the provider's sign-in page address and what to remember until the player returns. */
export async function startLogin(
  provider: Provider,
  config: AuthConfig,
  redirect: string,
): Promise<{ url: string; pending: PendingLogin }> {
  const state = randomString(16);
  if (provider === 'yandex') {
    const params = new URLSearchParams({
      response_type: 'token',
      client_id: config.yandexClientId ?? '',
      redirect_uri: redirect,
      state,
    });
    return { url: `${YANDEX_AUTHORIZE}?${params}`, pending: { provider, state } };
  }
  const codeVerifier = randomString(48);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.vkAppId ?? '',
    redirect_uri: redirect,
    state,
    code_challenge: await codeChallenge(codeVerifier),
    code_challenge_method: 's256',
    scope: 'vkid.personal_info',
  });
  return { url: `${VK_ID}/authorize?${params}`, pending: { provider, state, codeVerifier } };
}

export type RedirectResult =
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'yandex'; accessToken: string }
  | { kind: 'vk'; code: string; deviceId: string; codeVerifier: string; state: string };

/**
 * Reads the provider's answer from the address the player came back to. 'none' means this is
 * an ordinary page load. The state must match the pending login, so answers to sign-ins this
 * page did not start are refused.
 */
export function readRedirect(url: URL, pending: PendingLogin | undefined): RedirectResult {
  const hash = new URLSearchParams(url.hash.slice(1));
  const query = url.searchParams;
  const params = hash.has('access_token') || hash.has('error') ? hash : query;
  if (!params.has('state') && !params.has('error')) return { kind: 'none' };
  if (params.has('error')) {
    return { kind: 'error', message: params.get('error_description') ?? params.get('error')! };
  }
  if (!pending || params.get('state') !== pending.state) {
    return { kind: 'error', message: 'state mismatch' };
  }
  if (pending.provider === 'yandex') {
    const accessToken = params.get('access_token');
    return accessToken
      ? { kind: 'yandex', accessToken }
      : { kind: 'error', message: 'no access token' };
  }
  const code = params.get('code');
  const deviceId = params.get('device_id');
  if (!code || !deviceId || !pending.codeVerifier) {
    return { kind: 'error', message: 'no code' };
  }
  return { kind: 'vk', code, deviceId, codeVerifier: pending.codeVerifier, state: pending.state };
}

/** The same address without the provider's answer, to put back in the address bar. */
export function cleanUrl(url: URL): string {
  const clean = new URL(url);
  clean.hash = '';
  for (const key of ['code', 'state', 'device_id', 'type', 'expires_in', 'ext_id', 'error']) {
    clean.searchParams.delete(key);
  }
  clean.searchParams.delete('error_description');
  return clean.toString();
}

/** Turns the provider's answer into the player's profile. */
export async function finishLogin(
  result: Extract<RedirectResult, { kind: 'yandex' | 'vk' }>,
  config: AuthConfig,
  redirect: string,
  fetchFn: Fetch = fetch,
): Promise<Profile> {
  if (result.kind === 'yandex') return yandexProfile(result.accessToken, fetchFn);
  const appId = config.vkAppId ?? '';
  const exchange = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: redirect,
    client_id: appId,
    code_verifier: result.codeVerifier,
    device_id: result.deviceId,
    state: result.state,
  });
  const token = await postJson<{ access_token?: string; error?: string }>(
    fetchFn,
    `${VK_ID}/oauth2/auth?${exchange}`,
    { code: result.code },
  );
  if (!token.access_token) throw new Error(token.error ?? 'VK ID did not return a token');
  const info = await postJson<{
    user?: { first_name?: string; last_name?: string; avatar?: string };
  }>(fetchFn, `${VK_ID}/oauth2/user_info?${new URLSearchParams({ client_id: appId })}`, {
    access_token: token.access_token,
  });
  const name = [info.user?.first_name, info.user?.last_name].filter(Boolean).join(' ');
  return { provider: 'vk', name: name || 'VK ID', avatar: info.user?.avatar || undefined };
}

/** Reads the Yandex profile; if that fails the player is still signed in, just without a name. */
async function yandexProfile(accessToken: string, fetchFn: Fetch): Promise<Profile> {
  try {
    const response = await fetchFn(YANDEX_INFO, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = (await response.json()) as {
      display_name?: string;
      real_name?: string;
      login?: string;
      default_avatar_id?: string;
      is_avatar_empty?: boolean;
    };
    const avatar =
      info.default_avatar_id && !info.is_avatar_empty
        ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-68`
        : undefined;
    return {
      provider: 'yandex',
      name: info.display_name || info.real_name || info.login || 'Yandex ID',
      avatar,
    };
  } catch {
    return { provider: 'yandex', name: 'Yandex ID' };
  }
}

async function postJson<T>(fetchFn: Fetch, url: string, body: Record<string, string>): Promise<T> {
  const response = await fetchFn(url, { method: 'POST', body: new URLSearchParams(body) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}
