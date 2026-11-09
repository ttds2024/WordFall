# WordFall

A Halloween word game: letters fall, tap them to make words in a 2-minute round, on your own or against
an AI bot. English and
Russian.

See [docs/DESIGN.md](docs/DESIGN.md) for the design decisions.

The repository also holds **Small Realm** (`smallworld/`), a map game inspired by the board game
Small World, with one race, the Humans, against an AI rival. With `npm run dev` it is at
<http://localhost:5173/smallworld/>; the build publishes it at `smallworld/` next to the game. See
[docs/SMALL_REALM.md](docs/SMALL_REALM.md).

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
`dict/<lang>.txt`, which the game downloads when that language is chosen. There are lists for
English (`data/words_en.txt`) and Russian (`data/words_ru.txt`); Windows line endings are fine.

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

## Online scores (Supabase)

With a [Supabase](https://supabase.com/) project the game saves finished rounds and shows a
leaderboard on the start menu. Without one it plays as before, offline. There are no accounts:
each browser is a guest, known by a secret token it makes and keeps, with a name the player can
change in the leaderboard window. (This is for testing; it does not use the Yandex ID / VK ID
sign-in above.) The database lives in `supabase/migrations/`.

1. Create a project at <https://supabase.com/dashboard>. Note its **Project URL**
   (`https://<ref>.supabase.co`) and **publishable key** (Project Settings → API keys).
2. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add the
   repository variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (public values).
3. Put the database on the project, either way:
   - run the SQL in `supabase/migrations/` in the project's SQL editor, or
   - add the repository variable `SUPABASE_PROJECT_REF` (the `<ref>` in the URL) and the secrets
     `SUPABASE_ACCESS_TOKEN` (<https://supabase.com/dashboard/account/tokens>) and
     `SUPABASE_DB_PASSWORD`, then run the **Supabase** workflow. It runs by itself afterwards
     whenever `supabase/` changes on `main`, and skips itself while the secrets are not set.
4. Run **Deploy to GitHub Pages** again: the Leaderboard button appears.

For local development put `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

Scores are worked out by the database from the words of the round, not taken from the browser,
and a guest can save one round every 110 seconds. Words are not checked against the word list
there yet, and nothing stops someone making many guests, so treat the leaderboard as a test.
Clearing the browser's data makes a new guest; the old scores stay on the board under the old
name.

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
<https://ttds2024.github.io/WordFall/>.
