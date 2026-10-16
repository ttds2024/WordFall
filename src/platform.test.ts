import { describe, expect, it } from 'vitest';
import { detectPlatform, toPlatform } from './platform';

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
