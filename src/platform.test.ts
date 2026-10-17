import { describe, expect, it } from 'vitest';
import { detectPlatform, isMobile, toPlatform } from './platform';

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

describe('isMobile', () => {
  const PIXEL =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

  it('is true in the native apps', () => {
    expect(isMobile('android', WINDOWS, 0)).toBe(true);
    expect(isMobile('ios', WINDOWS, 0)).toBe(true);
  });

  it('recognises phones and tablets in a browser', () => {
    expect(isMobile('desktop', PIXEL, 5)).toBe(true);
    expect(isMobile('desktop', IPHONE, 5)).toBe(true);
    expect(isMobile('desktop', MAC, 5)).toBe(true); // iPad in desktop mode
  });

  it('is false on computers', () => {
    expect(isMobile('desktop', MAC, 0)).toBe(false);
    expect(isMobile('desktop', WINDOWS, 0)).toBe(false);
  });
});
