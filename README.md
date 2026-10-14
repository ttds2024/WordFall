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

## Platforms

Desktop (any web browser) is the default. Android and iOS apps wrap the same web build with
[Capacitor](https://capacitorjs.com/); the native projects live in `android/` and `ios/`.

```sh
npm run android  # build, sync and open in Android Studio
npm run ios      # build, sync and open in Xcode (macOS only)
```

The **Mobile builds** workflow builds a debug APK (downloadable from the run's artifacts) and an
unsigned iOS simulator build on every pull request and push to `main`. Phone apps are locked to
portrait.

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
<https://ttds2024.github.io/WordFall/>.
