/** Languages that have a word list in data/, set at build time by vite.config.ts. */
declare const __DICTIONARIES__: readonly ('en' | 'ru')[];

interface ImportMetaEnv {
  /** Yandex ID app's ClientID (oauth.yandex.ru); unset hides the Yandex sign-in button. */
  readonly VITE_YANDEX_CLIENT_ID?: string;
  /** VK ID app's ID (id.vk.ru/business/go); unset hides the VK sign-in button. */
  readonly VITE_VK_APP_ID?: string;
  /** The multiplayer server's WebSocket URL (wss://…/ws); unset hides "Play vs player". */
  readonly VITE_MULTIPLAYER_URL?: string;
}
