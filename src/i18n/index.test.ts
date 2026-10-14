import { describe, expect, it } from 'vitest';
import { detectLanguage, t } from './index';

describe('detectLanguage', () => {
  it('picks Russian from a regional tag', () => {
    expect(detectLanguage(['ru-RU', 'en-US'])).toBe('ru');
  });

  it('uses the first supported language', () => {
    expect(detectLanguage(['de-DE', 'en-GB', 'ru'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLanguage(['fr', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('t', () => {
  it('returns the string for the language', () => {
    expect(t('ru', 'clear')).toBe('Стереть');
  });
});
