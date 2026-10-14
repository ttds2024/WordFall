# WordFall

A Halloween word game: letters fall, tap them to make words before time runs out. English and
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

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
<https://ttds2024.github.io/WordFall/>.
