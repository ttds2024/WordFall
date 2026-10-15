import { describe, expect, it } from 'vitest';
import { detectPlatform, toPlatform, uiStyleFor } from './platform';

describe('toPlatform', () => {
  it('maps the native apps', () => {
    expect(toPlatform('android')).toBe('android');
    expect(toPlatform('ios')).toBe('ios');
  });

  it('defaults to desktop', () => {
    expect(toPlatform('web')).toBe('desktop');
    expect(toPlatform('')).toBe('desktop');
  });
});

describe('detectPlatform', () => {
  it('is desktop outside the native apps', () => {
    expect(detectPlatform()).toBe('desktop');
  });
});

describe('uiStyleFor', () => {
  const PIXEL =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

  it('follows the native app', () => {
    expect(uiStyleFor('android', WINDOWS, 0)).toBe('android');
    expect(uiStyleFor('ios', WINDOWS, 0)).toBe('ios');
  });

  it('recognises phones and tablets in a browser', () => {
    expect(uiStyleFor('desktop', PIXEL, 5)).toBe('android');
    expect(uiStyleFor('desktop', IPHONE, 5)).toBe('ios');
    expect(uiStyleFor('desktop', MAC, 5)).toBe('ios'); // iPad in desktop mode
  });

  it('keeps our own design on computers', () => {
    expect(uiStyleFor('desktop', MAC, 0)).toBe('desktop');
    expect(uiStyleFor('desktop', WINDOWS, 0)).toBe('desktop');
  });
});
