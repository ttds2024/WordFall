import { describe, expect, it, vi } from 'vitest';
import {
  cleanUrl,
  codeChallenge,
  enabledProviders,
  finishLogin,
  readRedirect,
  redirectUri,
  startLogin,
  type AuthConfig,
} from './auth';

const config: AuthConfig = { yandexClientId: 'yandex-app', vkAppId: '51234567' };
const REDIRECT = 'https://ttds2024.github.io/WordFall/';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('configuration', () => {
  it('offers only providers with an app ID', () => {
    expect(enabledProviders({})).toEqual([]);
    expect(enabledProviders({ vkAppId: '1' })).toEqual(['vk']);
    expect(enabledProviders(config)).toEqual(['yandex', 'vk']);
  });

  it('returns players to this page without query or fragment', () => {
    expect(redirectUri({ origin: 'https://ttds2024.github.io', pathname: '/WordFall/' })).toBe(
      REDIRECT,
    );
  });
});

describe('PKCE', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('startLogin', () => {
  it('sends Yandex players to the implicit flow', async () => {
    const { url, pending } = await startLogin('yandex', config, REDIRECT);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://oauth.yandex.ru/authorize');
    expect(u.searchParams.get('response_type')).toBe('token');
    expect(u.searchParams.get('client_id')).toBe('yandex-app');
    expect(u.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(u.searchParams.get('state')).toBe(pending.state);
    expect(pending).toMatchObject({ provider: 'yandex' });
  });

  it('sends VK players to OAuth 2.1 with PKCE', async () => {
    const { url, pending } = await startLogin('vk', config, REDIRECT);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://id.vk.ru/authorize');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('51234567');
    expect(u.searchParams.get('scope')).toBe('vkid.personal_info');
    expect(u.searchParams.get('code_challenge')).toBe(await codeChallenge(pending.codeVerifier!));
    expect(pending.codeVerifier!.length).toBeGreaterThanOrEqual(43);
  });
});

describe('readRedirect', () => {
  const yandex = { provider: 'yandex' as const, state: 's1' };
  const vk = { provider: 'vk' as const, state: 's2', codeVerifier: 'v' };

  it('ignores an ordinary page load', () => {
    expect(readRedirect(new URL(REDIRECT), yandex)).toEqual({ kind: 'none' });
  });

  it('reads a Yandex token from the fragment', () => {
    const url = new URL(`${REDIRECT}#access_token=tok&token_type=bearer&state=s1`);
    expect(readRedirect(url, yandex)).toEqual({ kind: 'yandex', accessToken: 'tok' });
  });

  it('reads a VK code from the query', () => {
    const url = new URL(`${REDIRECT}?code=c&state=s2&device_id=d&type=code_v2`);
    expect(readRedirect(url, vk)).toEqual({
      kind: 'vk',
      code: 'c',
      deviceId: 'd',
      codeVerifier: 'v',
      state: 's2',
    });
  });

  it('refuses answers to sign-ins this page did not start', () => {
    const url = new URL(`${REDIRECT}#access_token=tok&state=other`);
    expect(readRedirect(url, yandex)).toMatchObject({ kind: 'error' });
    expect(readRedirect(url, undefined)).toMatchObject({ kind: 'error' });
  });

  it('reports a provider error', () => {
    const url = new URL(`${REDIRECT}#error=access_denied&state=s1`);
    expect(readRedirect(url, yandex)).toEqual({ kind: 'error', message: 'access_denied' });
  });
});

describe('cleanUrl', () => {
  it('removes the provider answer and keeps everything else', () => {
    expect(cleanUrl(new URL(`${REDIRECT}?code=c&state=s&device_id=d&type=code_v2&x=1#y`))).toBe(
      `${REDIRECT}?x=1`,
    );
  });
});

describe('finishLogin', () => {
  it('reads the Yandex profile with the token', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json({ display_name: 'Ann', default_avatar_id: '123/abc', is_avatar_empty: false }),
      );
    const profile = await finishLogin(
      { kind: 'yandex', accessToken: 'tok' },
      config,
      REDIRECT,
      fetchFn,
    );
    expect(profile).toEqual({
      provider: 'yandex',
      name: 'Ann',
      avatar: 'https://avatars.yandex.net/get-yapic/123/abc/islands-68',
    });
    expect(fetchFn.mock.calls[0]![1].headers).toEqual({ Authorization: 'OAuth tok' });
  });

  it('still signs a Yandex player in when the profile cannot be read', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const profile = await finishLogin(
      { kind: 'yandex', accessToken: 'tok' },
      config,
      REDIRECT,
      fetchFn,
    );
    expect(profile).toEqual({ provider: 'yandex', name: 'Yandex ID' });
  });

  it('exchanges the VK code, then reads the profile', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: 'at', state: 's2' }))
      .mockResolvedValueOnce(
        json({ user: { first_name: 'Ivan', last_name: 'P', avatar: 'a.jpg' } }),
      );
    const result = {
      kind: 'vk' as const,
      code: 'c',
      deviceId: 'd',
      codeVerifier: 'v',
      state: 's2',
    };
    const profile = await finishLogin(result, config, REDIRECT, fetchFn);
    expect(profile).toEqual({ provider: 'vk', name: 'Ivan P', avatar: 'a.jpg' });

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0]!;
    const u = new URL(tokenUrl);
    expect(u.origin + u.pathname).toBe('https://id.vk.ru/oauth2/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT,
      client_id: '51234567',
      code_verifier: 'v',
      device_id: 'd',
      state: 's2',
    });
    expect(String(tokenInit.body)).toBe('code=c');
    expect(String(fetchFn.mock.calls[1]![1].body)).toBe('access_token=at');
  });

  it('fails when VK ID returns no token', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: 'invalid_grant' }));
    const result = { kind: 'vk' as const, code: 'c', deviceId: 'd', codeVerifier: 'v', state: 's' };
    await expect(finishLogin(result, config, REDIRECT, fetchFn)).rejects.toThrow('invalid_grant');
  });
});
