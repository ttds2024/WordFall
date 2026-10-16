# WordFall — design decisions (v1)

Letters fall from the top of the screen. The player taps letters to build words.

## Start menu

The game opens on a start menu with two modes:

- **Play 5 min:** a 5-minute round. The timer under the score turns red in the last 30 seconds;
  when it runs out the menu comes back with the final score.
- **Infinity:** no timer; the round lasts until the player leaves it.

The **☰** button ends the round and returns to the menu, showing the score. Opening Settings pauses
the round, including the timer. Changing the language restarts the round in the same mode.

## Accounts

Players can sign in with **Yandex ID** or **VK ID** from the start menu; signed in, the menu shows
their name, avatar and provider with a Sign out button. Signing in is optional and changes nothing
in the game yet.

- No server: Yandex ID uses the OAuth implicit flow, VK ID OAuth 2.1 with PKCE and no client
  secret, both from the browser (`src/auth/`). Access tokens are used once to read the profile and
  never stored; only the name, avatar and provider are kept in local storage.
- The `state` sent to the provider must come back unchanged, and is accepted only once, so a
  forged or replayed answer is refused.
- App IDs come from the build (`VITE_YANDEX_CLIENT_ID`, `VITE_VK_APP_ID`, filled from GitHub
  repository variables); a provider without one is hidden.
- **Sber ID** needs a client secret and a TLS client certificate, so it waits for a backend.

## Physics

- **Engine:** Matter.js.
- **Floor:** letters land on a floor and pile up. Piled letters can still be tapped. The pile never
  ends the game in v1.
- **Tiles:** round (pumpkins), so they roll and bounce. About 1 tile in 10 is a **skull**: it carries a
  letter like a pumpkin, and a correct word that uses at least one skull scores **×2** (two skulls
  still ×2). The word bar shows 💀×2 while the word holds a skull.
- **Jokers:** about 1 tile in 25 is a gold **star** (`src/images/star.svg`) with no letter. It stands for any one letter: the
  word counts if some dictionary word fits it, and the status line names that word (e.g. C★T is
  "In the word list: CAT"). If several words fit, the first one not found yet is used, so C★T can
  score CAT, then COT, then CUT. A joker scores 0 points, like a blank in Scrabble. A word can hold
  at most **one** joker: tapping a second star does nothing except show "Only one star per word".
- **Speed:** constant; no difficulty curve yet.

## Submitting words

Tapping a letter that is already in the word checks the word; tapping the field away from any
letter clears it. There is no automatic submitting and no Submit or Clear button; on a keyboard,
Enter checks the word and Esc/Backspace clears it.

Minimum word length is 3 letters in both languages.

## Languages

- English and Russian. A setting switches the letters, the dictionary and the interface text
  together. The first language follows the device language.
- Ё and Е count as the same letter.
- English words come from `data/words_en.txt` (any lower-case entry of 3+ letters counts).
  Russian words will be supplied later.

## Temporary rules

- **Score:** Scrabble letter values (English) and Эрудит letter values (Russian).
- **Letter frequency:** weighted like real text in each language.
- **High score:** later.

## Look and sound

- Duolingo-inspired, dark only, the same on every device: a deep blue-grey background, the rounded
  bold font Nunito (Google Fonts; a system rounded font when offline), flat bright colours (green
  for the main action, blue for the second, yellow score, red for misses) and chunky buttons and
  choice cards with a solid bottom edge that presses down when tapped. Only the style is borrowed:
  no Duolingo name, owl or logo. The game field keeps its Halloween pumpkins, skulls and stars.
- All artwork drawn in code as SVG (pumpkins, bats, moon, gravestones).
- Sound effects and background music come later, each with its own on/off switch in Settings.

## Tech

- TypeScript, Vite, Vitest, ESLint, Prettier.
- Platforms: desktop browser (default), Android and iOS apps via Capacitor. Phones are portrait
  only (not enforced while the native projects are generated in CI). App id
  `io.github.ttds2024.wordfall`.
- Deployed to GitHub Pages by GitHub Actions on every push to `main`. A repository admin must set
  **Settings → Pages → Source** to **GitHub Actions**.

## Delivery plan

Small pull requests, in order:

1. Project setup
2. Physics: falling, tappable pumpkin tiles (canvas, Matter.js)
3. Words: selection, validation, scoring, submit modes
4. Screens: start, game, results, settings
5. Artwork and sound
6. ~~Deployment to GitHub Pages~~ (done early)
