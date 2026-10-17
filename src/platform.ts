import { Capacitor } from '@capacitor/core';

/** Where the game runs. Desktop (any browser) is the default; Android and iOS are the native apps. */
export type Platform = 'desktop' | 'android' | 'ios';

export function toPlatform(capacitorPlatform: string): Platform {
  return capacitorPlatform === 'android' || capacitorPlatform === 'ios'
    ? capacitorPlatform
    : 'desktop';
}

export function detectPlatform(): Platform {
  return toPlatform(Capacitor.getPlatform());
}

/**
 * Whether the game runs on a phone or tablet: the native apps, or a browser on Android, iPhone or
 * iPad. iPadOS reports itself as a Mac, so a Mac with a touch screen counts as mobile.
 */
export function isMobile(platform: Platform, userAgent: string, maxTouchPoints: number): boolean {
  if (platform !== 'desktop') return true;
  if (/android|iphone|ipad|ipod/i.test(userAgent)) return true;
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}
