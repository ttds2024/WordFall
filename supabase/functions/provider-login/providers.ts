/**
 * Checks a Yandex ID or VK ID access token with its provider and says whose it is. Used by the
 * provider-login Edge Function; kept free of Deno APIs so the game's unit tests cover it.
 */

export type Provider = 'yandex' | 'vk';

/** The app IDs the game signs in with; a token issued to any other app is refused. */
export interface ProviderConfig {
  yandexClientId?: string;
  vkAppId?: string;
}

/** A player as their provider knows them. */
export interface Identity {
  provider: Provider;
  /** The provider's own ID for this player; stable across sign-ins. */
  id: string;
  name: string;
  avatar?: string;
}

type Fetch = typeof fetch;

const YANDEX_INFO = 'https://login.yandex.ru/info?format=json';
const VK_USER_INFO = 'https://id.vk.ru/oauth2/user_info';
const MAX_NAME = 80;

export function isProvider(value: unknown): value is Provider {
  return value === 'yandex' || value === 'vk';
}

/** Throws unless the provider confirms the token, and that it was issued to this game's app. */
export async function verifyProvider(
  provider: Provider,
  accessToken: string,
  config: ProviderConfig,
  fetchFn: Fetch = fetch,
): Promise<Identity> {
  return provider === 'yandex'
    ? verifyYandex(accessToken, config.yandexClientId, fetchFn)
    : verifyVk(accessToken, config.vkAppId, fetchFn);
}

async function verifyYandex(
  accessToken: string,
  clientId: string | undefined,
  fetchFn: Fetch,
): Promise<Identity> {
  if (!clientId) throw new Error('Yandex ID is not set up');
  const response = await fetchFn(YANDEX_INFO, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Yandex ID refused the token (HTTP ${response.status})`);
  const info = (await response.json()) as {
    id?: string | number;
    client_id?: string;
    display_name?: string;
    real_name?: string;
    login?: string;
    default_avatar_id?: string;
    is_avatar_empty?: boolean;
  };
  // A token another app obtained for this player must not sign them in here.
  if (info.client_id !== clientId) throw new Error('The token was issued to another app');
  if (info.id === undefined || info.id === '') throw new Error('Yandex ID returned no user ID');
  return {
    provider: 'yandex',
    id: String(info.id),
    name: cleanName(info.display_name || info.real_name || info.login, 'Yandex ID'),
    avatar:
      info.default_avatar_id && !info.is_avatar_empty
        ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-68`
        : undefined,
  };
}

async function verifyVk(
  accessToken: string,
  appId: string | undefined,
  fetchFn: Fetch,
): Promise<Identity> {
  if (!appId) throw new Error('VK ID is not set up');
  // VK ID answers only for a token issued to the app named in client_id.
  const response = await fetchFn(`${VK_USER_INFO}?${new URLSearchParams({ client_id: appId })}`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: accessToken }),
  });
  if (!response.ok) throw new Error(`VK ID refused the token (HTTP ${response.status})`);
  const info = (await response.json()) as {
    user?: { user_id?: string | number; first_name?: string; last_name?: string; avatar?: string };
    error?: string;
  };
  const id = info.user?.user_id;
  if (id === undefined || id === '') throw new Error(info.error ?? 'VK ID returned no user ID');
  const name = [info.user?.first_name, info.user?.last_name].filter(Boolean).join(' ');
  return {
    provider: 'vk',
    id: String(id),
    name: cleanName(name, 'VK ID'),
    avatar: httpsUrl(info.user?.avatar),
  };
}

function cleanName(name: string | undefined, fallback: string): string {
  return (name ?? '').trim().slice(0, MAX_NAME) || fallback;
}

function httpsUrl(value: string | undefined): string | undefined {
  return value?.startsWith('https://') ? value : undefined;
}

/**
 * The address a player's Supabase account is filed under. No mail is ever sent to it (.invalid
 * cannot receive any); it only ties the account to the provider's ID for this player.
 */
export function accountEmail(identity: Pick<Identity, 'provider' | 'id'>): string {
  const id = identity.id.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${identity.provider}-${id}@players.wordfall.invalid`;
}
