# WordFall — design decisions (v1)

Letters fall from the top of the screen. The player taps letters to build words before the
120-second round ends.

## Physics

- **Engine:** Matter.js.
- **Floor:** letters land on a floor and pile up. Piled letters can still be tapped. The pile never
  ends the game in v1; the round always lasts 120 seconds.
- **Tiles:** round (pumpkins), so they roll and bounce.
- **Speed:** constant; no difficulty curve yet.

## Submitting words

A setting chooses the mode:

- **Submit button:** the player taps **Submit** when the word is ready.
- **Auto:** the word is submitted when it is valid and no longer word can follow it, or after about
  1.5 seconds with no new letter.

Both modes have a **Clear** button. Backspace comes later.

Minimum word length is 3 letters in both languages.

## Languages

- English and Russian. A setting switches the letters, the dictionary and the interface text
  together. The first language follows the device language.
- Ё and Е count as the same letter.
- Dictionaries will be supplied later.

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
- Deployed to GitHub Pages by GitHub Actions on every push to `main`. A repository admin must set
  **Settings → Pages → Source** to **GitHub Actions**.

## Delivery plan

Small pull requests, in order:

1. Project setup (this PR)
2. Physics: falling, tappable pumpkin tiles
3. Words: selection, validation, scoring, submit modes
4. Screens: start, game, results, settings
5. Artwork and sound
6. Deployment to GitHub Pages
