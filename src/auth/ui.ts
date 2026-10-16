import { t, type Language } from '../i18n';
import {
  cleanUrl,
  enabledProviders,
  finishLogin,
  readRedirect,
  redirectUri,
  startLogin,
  type AuthConfig,
  type Profile,
  type Provider,
} from './auth';
import { loadProfile, savePending, saveProfile, takePending, type AuthStorage } from './store';

const PROVIDER_NAMES: Record<Provider, string> = { yandex: 'Yandex ID', vk: 'VK ID' };

/** App IDs come from the build (VITE_YANDEX_CLIENT_ID, VITE_VK_APP_ID); unset means hidden. */
const CONFIG: AuthConfig = {
  yandexClientId: import.meta.env.VITE_YANDEX_CLIENT_ID || undefined,
  vkAppId: import.meta.env.VITE_VK_APP_ID || undefined,
};

function storageOf(get: () => Storage): Storage | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

function element<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

/**
 * The sign-in block on the start menu. Finishes a sign-in when the page is the provider's
 * return address. Returns render(), to call when the language changes.
 */
export function setupAuth(language: () => Language): { render(): void } {
  const providers = enabledProviders(CONFIG);
  const storage: AuthStorage = {
    local: storageOf(() => window.localStorage),
    session: storageOf(() => window.sessionStorage),
  };
  const ui = {
    account: element('#account'),
    signedOut: element('#signed-out'),
    signedIn: element('#signed-in'),
    avatar: element<HTMLImageElement>('#profile-avatar'),
    name: element('#profile-name'),
    via: element('#profile-via'),
    signOut: element<HTMLButtonElement>('#sign-out'),
    error: element('#auth-error'),
    buttons: {
      yandex: element<HTMLButtonElement>('#sign-in-yandex'),
      vk: element<HTMLButtonElement>('#sign-in-vk'),
    } satisfies Record<Provider, HTMLButtonElement>,
  };

  let profile: Profile | undefined = loadProfile(storage);
  let busy = false;
  let failed = false;

  function render(): void {
    const lang = language();
    ui.account.hidden = providers.length === 0 && !profile;
    ui.signedOut.hidden = Boolean(profile);
    ui.signedIn.hidden = !profile;
    for (const provider of ['yandex', 'vk'] as const) {
      ui.buttons[provider].hidden = !providers.includes(provider);
      ui.buttons[provider].disabled = busy;
    }
    ui.error.textContent = busy ? t(lang, 'signingIn') : failed ? t(lang, 'signInFailed') : '';
    ui.error.hidden = !busy && !failed;
    if (profile) {
      ui.name.textContent = profile.name;
      ui.via.textContent = PROVIDER_NAMES[profile.provider];
      ui.avatar.hidden = !profile.avatar;
      if (profile.avatar) ui.avatar.src = profile.avatar;
      else ui.avatar.removeAttribute('src');
    }
  }

  async function signIn(provider: Provider): Promise<void> {
    busy = true;
    failed = false;
    render();
    const { url, pending } = await startLogin(provider, CONFIG, redirectUri(location));
    savePending(storage, pending);
    location.assign(url);
  }

  /** If the page was opened by the provider after sign-in, finish it. */
  async function finishRedirect(): Promise<void> {
    const url = new URL(location.href);
    const pending = takePending(storage);
    const result = readRedirect(url, pending);
    if (result.kind === 'none') return;
    history.replaceState(history.state, '', cleanUrl(url));
    if (result.kind === 'error') {
      failed = true;
      render();
      return;
    }
    busy = true;
    render();
    try {
      profile = await finishLogin(result, CONFIG, redirectUri(location));
      saveProfile(storage, profile);
    } catch {
      failed = true;
    }
    busy = false;
    render();
  }

  for (const provider of providers) {
    ui.buttons[provider].addEventListener('click', () => {
      signIn(provider).catch(() => {
        busy = false;
        failed = true;
        render();
      });
    });
  }
  ui.signOut.addEventListener('click', () => {
    profile = undefined;
    failed = false;
    saveProfile(storage, undefined);
    render();
  });

  render();
  void finishRedirect();
  return { render };
}
