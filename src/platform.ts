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
