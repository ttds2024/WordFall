# WordFall — design decisions (v1)

Letters fall from the top of the screen. The player taps letters to build words.

## Start menu

The game opens on a start menu with two modes:

- **Play 2 min:** a 2-minute round on your own. The top bar shows your score next to the timer, a
  green ring that empties anticlockwise over the round with the seconds left inside, red in the last 30 seconds; when it runs out the menu comes back with the final score.
- **Play vs AI:** a 2-minute round against a bot (see below).

There is no untimed mode: a round against the bot needs an end to decide who won.

The **☰** button pauses the round (timer and bot included) and opens the menu, with an **✕** in
the top-right corner (or Esc) that closes it and resumes the game where it was left; starting a new
game from that menu replaces the paused round, and changing the language drops it. When the time
runs out the menu shows the score. Settings (the language)
open from the start menu only; there is no Settings button during a round.

## Playing against a bot

**Play vs AI** on the start menu starts a 2-minute round against the bot:

- Every 6–10 seconds of play the bot picks letters from the field (never the player's current
  letters, stars or bad pumpkins) and rings them in blue for about a second while it "thinks".
- With probability 0.5 it goes for a real word: a random dictionary word of 3–6 letters that can be
  spelled from the field and has not been found yet. Its letters disappear and it scores like the
  player (×2 pumpkins included). Otherwise it picks 3–4 letters that spell nothing, shows "Bot
  missed", and the letters stay in play. If the field holds no word it can spell, it misses too.
- Found words are shared: a word the bot finds cannot be scored by the player, and vice versa.
- The top bar becomes a face-off: the player's card (green edge, avatar letter from the signed-in
  name or "You", yellow score) on the left, the bot's card (blue edge, robot icon, blue score) on
  the right, and between them the round timer as a ring that empties over the 2 minutes, with the
  whole seconds left inside; it turns red in the last 30 seconds. ☰ sits beside the bot's card and
  the word being built goes on the row below. The same compact design on phones and desktops; on
  wide screens the score group keeps its phone width (at most 480 px), centred. There is
  no "who's ahead" indicator beyond the two scores. At the end the menu says who won.

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
- **Tiles:** round (pumpkins), so they roll and bounce.
- **Bad pumpkins:** about 1 tile in 10 is a grinning jack-o'-lantern (`src/images/bad.png`) with no
  letter; it cannot be tapped. When it first hits anything (the floor or another tile) it explodes
  with a flash, destroying every tile within about 2.6 tile radii and pushing the next ones away.
  Letters it destroys leave the word being built and score nothing.
- **×2 pumpkins:** about 1 tile in 12 is a plain pumpkin (`src/images/pumpkin.svg`) with a letter
  and a gold ×2 mark. A correct word scores its letters times **2 × N**, N being the number of ×2
  pumpkins in it (one: ×2, two: ×4, three: ×6); the word bar shows the multiplier while the word
  holds one.
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

A correct word pops up where its tiles were, as a badge with its points (and ×2 when doubled) over
the word, then rises about 130 px and fades out over 1.2 s; the score at the top bounces. With
reduced motion turned on, the badge only fades. Misses still show a red message at the top.

## Languages

- English and Russian. A setting switches the letters, the dictionary and the interface text
  together. The first language follows the device language.
- Ё and Е count as the same letter.
- Words come from `data/words_en.txt` and `data/words_ru.txt` (any lower-case entry of 3+ letters
  counts; multi-word entries such as «а-ля фуршет» are dropped). The Russian list has about 124,000
  playable words.

## Temporary rules

- **Score:** Scrabble letter values (English) and Эрудит letter values (Russian).
- **Letter frequency:** weighted like real text in each language.
- **High score:** later.

## Look and sound

- Duolingo-inspired, dark only, the same on every device: a deep blue-grey background, the rounded
  bold font Nunito (Google Fonts; a system rounded font when offline), flat bright colours (green
  for the main action, blue for the second, yellow score, red for misses) and chunky buttons and
  choice cards with a solid bottom edge that presses down when tapped. Only the style is borrowed:
  no Duolingo name, owl or logo. The game field keeps its Halloween pumpkins and stars.
- **8-bit style:** Settings → **Style** switches between Classic (above, the default) and 8-bit:
  the PICO-8 palette, the pixel font Press Start 2P, square corners and hard shadows, a plain navy
  background instead of the picture, square pixel tiles (orange letters, ×2 chip, purple ★ joker,
  red bomb tile with square sparks when it blows) and the timer ring in 16 blocks.
- **Background picture:** `src/images/small.jpeg` (tall) on phones and tablets, in the Android/iOS
  apps and in phone browsers alike, and `src/images/big.jpg` (wide) on computers; only the one in
  use is downloaded. A dark shade over it keeps letters and buttons readable, and the start menu
  blurs it.
- All artwork drawn in code as SVG (pumpkins, bats, moon, gravestones).
- **Sound:** `src/audio/clicked.mp3` plays when the player taps a letter into the word, and
  `src/audio/success.mp3` when the player's word is correct (the bot's words are silent). Played
  through Web Audio, started by the first tap. Settings → **Sound** turns them on (default) or off.
  Background music comes later.

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
