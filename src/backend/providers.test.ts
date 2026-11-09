import { describe, expect, it, vi } from 'vitest';
import {
  accountEmail,
  isProvider,
  verifyProvider,
} from '../../supabase/functions/provider-login/providers';

const config = { yandexClientId: 'yandex-app', vkAppId: '51234567' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('verifyProvider (the sign-in function)', () => {
  it('accepts a Yandex token issued to the game', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: '1000034426',
        client_id: 'yandex-app',
        display_name: 'Ann',
        default_avatar_id: '123/abc',
        is_avatar_empty: false,
      }),
    );
    expect(await verifyProvider('yandex', 'tok', config, fetchFn)).toEqual({
      provider: 'yandex',
      id: '1000034426',
      name: 'Ann',
      avatar: 'https://avatars.yandex.net/get-yapic/123/abc/islands-68',
    });
    expect(fetchFn.mock.calls[0]![1].headers).toEqual({ Authorization: 'OAuth tok' });
  });

  it("refuses a Yandex token issued to another app, or one Yandex doesn't know", async () => {
    const other = vi.fn().mockResolvedValue(json({ id: '1', client_id: 'someone-else' }));
    await expect(verifyProvider('yandex', 'tok', config, other)).rejects.toThrow('another app');
    const unknown = vi.fn().mockResolvedValue(json({}, 401));
    await expect(verifyProvider('yandex', 'tok', config, unknown)).rejects.toThrow('HTTP 401');
  });

  it('asks VK ID about the token as the game, and reads who it is', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json({ user: { user_id: 42, first_name: 'Ivan', last_name: 'P', avatar: 'https://a/b' } }),
      );
    expect(await verifyProvider('vk', 'at', config, fetchFn)).toEqual({
      provider: 'vk',
      id: '42',
      name: 'Ivan P',
      avatar: 'https://a/b',
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://id.vk.ru/oauth2/user_info?client_id=51234567');
    expect(String(init.body)).toBe('access_token=at');
  });

  it('refuses a VK token that names no player', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: 'invalid_token' }));
    await expect(verifyProvider('vk', 'at', config, fetchFn)).rejects.toThrow('invalid_token');
  });

  it('refuses a provider that is not set up', async () => {
    const fetchFn = vi.fn();
    await expect(verifyProvider('vk', 'at', {}, fetchFn)).rejects.toThrow('not set up');
    await expect(verifyProvider('yandex', 'at', {}, fetchFn)).rejects.toThrow('not set up');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cuts very long names and falls back when there is none', async () => {
    const long = vi
      .fn()
      .mockResolvedValue(json({ id: 1, client_id: 'yandex-app', display_name: 'x'.repeat(200) }));
    expect((await verifyProvider('yandex', 't', config, long)).name).toHaveLength(80);
    const none = vi.fn().mockResolvedValue(json({ user: { user_id: 7 } }));
    expect((await verifyProvider('vk', 't', config, none)).name).toBe('VK ID');
  });
});

describe('accounts', () => {
  it('files each player under their provider and ID', () => {
    expect(accountEmail({ provider: 'yandex', id: '1000034426' })).toBe(
      'yandex-1000034426@players.wordfall.invalid',
    );
    expect(accountEmail({ provider: 'vk', id: '42' })).toBe('vk-42@players.wordfall.invalid');
  });

  it('knows its providers', () => {
    expect(isProvider('vk')).toBe(true);
    expect(isProvider('sber')).toBe(false);
  });
});
