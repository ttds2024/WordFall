# WordFall

A Halloween word game: letters fall, tap them to make words in a 5-minute round or with no timer
(Infinity). English and
Russian.

See [docs/DESIGN.md](docs/DESIGN.md) for the design decisions.

## Development

```sh
npm install
npm run dev      # start the dev server
npm run check    # typecheck, lint, format check, unit tests
npm run build    # production build in dist/
```

## Word lists

`data/words_<lang>.txt` holds one word per line. At build time the list is cleaned (lower-case
letters only, at least 3 letters, Ё folded into Е, no names or abbreviations) and published as
`dict/<lang>.txt`, which the game downloads on start. Only English (`data/words_en.txt`) exists so
far; drop in `data/words_ru.txt` to enable Russian.

## Platforms

Desktop (any web browser) is the default. Android and iOS apps wrap the same web build with
[Capacitor](https://capacitorjs.com/). The native projects are not kept in the repository;
generate them once with `npx cap add android` / `npx cap add ios --packagemanager SPM`.

```sh
npm run android  # build, sync and open in Android Studio
npm run ios      # build, sync and open in Xcode (macOS only)
```

The **Mobile builds** workflow builds a debug APK (downloadable from the run's artifacts) and an
unsigned iOS simulator build on every pull request and push to `main`.

## Sign-in (Yandex ID, VK ID)

Players can sign in on the start menu; the game then shows their name and avatar. It all happens
in the browser (the site has no server), and nothing but the name and avatar is kept, in the
browser, until the player signs out. Each button stays hidden until its app ID is set.

1. **Yandex ID:** create an app at <https://oauth.yandex.ru/client/new> for the web, with access to
   the user's name and avatar (login:info, login:avatar). Add the game's address as a Redirect URI,
   exactly: `https://ttds2024.github.io/WordFall/` (and `http://localhost:5173/` for development).
   Copy its **ClientID**.
2. **VK ID:** create a web app at <https://id.vk.ru/business/go>, add `ttds2024.github.io` as a
   trusted domain and the same address as a trusted redirect URL. Copy its **app ID**.
3. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add
   `YANDEX_CLIENT_ID` and `VK_APP_ID`. They are public IDs, not secrets. The next deploy shows the
   buttons. For local development put them in `.env.local` as `VITE_YANDEX_CLIENT_ID` and
   `VITE_VK_APP_ID`.

Sber ID is not supported yet: it needs a client secret and a TLS client certificate issued by Sber,
which must live on a server.

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
<https://ttds2024.github.io/WordFall/>.
