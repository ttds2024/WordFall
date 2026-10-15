# WordFall — design decisions (v1)

Letters fall from the top of the screen. The player taps letters to build words.

## Start menu

The game opens on a start menu with two modes:

- **Play 5 min:** a 5-minute round. The timer under the score turns red in the last 30 seconds;
  when it runs out the menu comes back with the final score.
- **Infinity:** no timer; the round lasts until the player leaves it.

The **☰** button ends the round and returns to the menu, showing the score. Opening Settings pauses
the round, including the timer. Changing the language restarts the round in the same mode.

## Physics

- **Engine:** Matter.js.
- **Floor:** letters land on a floor and pile up. Piled letters can still be tapped. The pile never
  ends the game in v1.
- **Tiles:** round (pumpkins), so they roll and bounce.
- **Speed:** constant; no difficulty curve yet.

## Submitting words

A setting chooses the mode (default: Submit button):

- **Submit button:** the player taps **Submit** when the word is ready.
- **Auto:** the word is submitted when it is valid and no longer word can follow it, or after about
  1.5 seconds with no new letter.

Both modes have a **Clear** button. Backspace comes later.

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

- Dark Halloween theme only; no light mode.
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
