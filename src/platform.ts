import { Capacitor } from '@capacitor/core';

/** Where the game runs. Desktop (any browser) is the default; Android and iOS are the native apps. */
export type Platform = 'desktop' | 'android' | 'ios';

/** Which design the interface follows: Material on Android, Apple's on iOS, our own elsewhere. */
export type UiStyle = Platform;

export function toPlatform(capacitorPlatform: string): Platform {
  return capacitorPlatform === 'android' || capacitorPlatform === 'ios'
    ? capacitorPlatform
    : 'desktop';
}

export function detectPlatform(): Platform {
  return toPlatform(Capacitor.getPlatform());
}

/**
 * The design to use: the native app's platform, or else the device the browser runs on.
 * iPadOS reports itself as a Mac, so a Mac with a touch screen counts as iOS.
 */
export function uiStyleFor(platform: Platform, userAgent: string, maxTouchPoints: number): UiStyle {
  if (platform !== 'desktop') return platform;
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function detectUiStyle(): UiStyle {
  return uiStyleFor(detectPlatform(), navigator.userAgent, navigator.maxTouchPoints);
}
