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
- **Tiles:** round (pumpkins), so they roll and bounce. About 1 tile in 10 is a **skull**: it carries a
  letter like a pumpkin, and a correct word that uses at least one skull scores **×2** (two skulls
  still ×2). The word bar shows 💀×2 while the word holds a skull.
- **Jokers:** about 1 tile in 25 is a gold **star** with no letter. It stands for any one letter: the
  word counts if some dictionary word fits it, and the status line names that word (e.g. C★T is
  "In the word list: CAT"). If several words fit, the first one not found yet is used, so C★T can
  score CAT, then COT, then CUT. A joker scores 0 points, like a blank in Scrabble.
- **Speed:** constant; no difficulty curve yet.

## Submitting words

Tapping a letter that is already in the word checks the word; tapping the field away from any
letter clears it. A setting chooses the mode (default: by tap):

- **By tap:** the word is checked only when the player taps one of its letters (or presses Enter).
- **Auto:** the word is submitted when it is valid and no longer word can follow it, or after about
  1.5 seconds with no new letter.

In both modes a tap on one of the word's letters checks it straight away. There are no Submit or
Clear buttons; on a keyboard, Enter checks the word and Esc/Backspace clears it.

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
- The interface follows the player's device, in the same dark colours: Material Design 3 on Android
  (pill buttons, round icon buttons, a rounded dialog with a text button, a snackbar at the bottom)
  and Apple's iOS style on iPhone and iPad (system font, translucent bar, Settings as a bottom sheet
  with grouped lists and checkmarks). This applies to the apps and to phone browsers alike
  (`src/ui-android.css`, `src/ui-ios.css`); computers keep the game's own design. The game field
  looks the same everywhere.
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
