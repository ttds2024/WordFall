# WordFall — design decisions (v1)

Letters fall from the top of the screen. The player taps letters to build words.

## Start menu

The game opens on a start menu with two modes:

- **Play 2 min:** a 2-minute round on your own. The top bar shows your score next to the timer, a
  green ring that empties anticlockwise over the round with the seconds left inside, red in the last 30 seconds; when it runs out the result window shows the final score.
- **Play vs AI:** a 2-minute round against a bot (see below).
- **Play vs player:** a 2-minute round online against another person, by quick match or in a
  private room with a code; see [MULTIPLAYER.md](MULTIPLAYER.md). Shown only when the game was
  built with a multiplayer server address.
- **Play vs friend:** a 2-minute match against another player (see Playing against a friend);
  shown only when the game has a backend.

There is no untimed mode: a round against the bot needs an end to decide who won.

The **☰** button pauses the round (timer and bot included) and opens the menu, with an **✕** in
the top-right corner (or Esc) that closes it and resumes the game where it was left; starting a new
game from that menu replaces the paused round, and changing the language drops it. When the time
runs out a result window opens over the start menu: the title (time's up, or who won against the
bot), your score and the bot's, **Play again** (the same mode) and **Menu**. Settings (the language)
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
  no "who's ahead" indicator beyond the two scores. At the end the result window says who won.

## Playing against a friend

**Play vs friend** opens a window to create a match or join one. It needs the backend (see Online
scores), and is hidden without it.

- **The code:** creating a match makes a 5-character code (letters and digits, without the
  look-alikes I, O, 0 and 1) and waits. The friend types it, in any case, or opens the link
  **Copy link** gives (`?match=CODE`), which opens the window with the code filled in. The round
  starts for both the moment the friend joins. A code nobody is waiting on is refused after 6
  seconds; a third player is told the match is full.
- **The round:** each player has their own field, in their own language and style, for the same
  2 minutes. The round is the same for both: it starts at the same moment (a second after the
  friend joins, the joiner allowing for the time the answer took to reach them), its time runs on
  the clock and not on play time, so it ends at the same moment even if a player's game was held
  up (their tab was in the background), and the same tiles fall in the same order and columns
  for both (the creator sends a seed for them; players in different languages get different
  letters). The top bar is the face-off of a round against the bot, with the
  friend's name, initial and live score in the bot's place. What a player does on their field
  (words, explosions) does not touch the other's.
- **No pause:** ☰ leaves the match; the friend is told and plays on to the end of their time.
- **The result:** when the time runs out the result window says who won, with both scores. If the
  friend's time is not up yet (their game was held up) it says it is waiting for them, for at most
  10 seconds, and their score keeps updating; after that their last score counts. If the friend
  left, it says so. **New match** opens the window again: a rematch is a new code.
- **How it works:** nothing is stored. The two browsers exchange small messages (join, start
  with the seed, score, final score, left) over a Supabase Realtime broadcast channel named after the code
  (`src/backend/match.ts`). Each browser reports its own score, which is fine between friends;
  match rounds are not saved and do not go on the leaderboard.

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
- Online play sends the signed-in name (or "Player") to the multiplayer server, which shows it to
  the other player and keeps nothing.

## Online scores

Optional, on **Supabase** (`supabase/`, `src/backend/`), for testing. A build without
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` has none of it and never downloads the
Supabase library. The site itself stays on GitHub Pages.

- **Guests, no accounts:** the first visit makes the browser a guest: a random 256-bit secret
  token, kept in local storage with a name ("Guest 4821" until the player changes it in the
  leaderboard window; at most 24 characters). Whoever holds the token is that player. The database
  keeps only the token's SHA-256. This is separate from the Yandex ID / VK ID sign-in, which still
  only shows the name and avatar.
- **Rounds:** when the time runs out the round is saved by `submit_round()`: the token, the name,
  the mode, the language, the words with their multipliers and the bot's score. A guest's first
  round makes them a player; each round updates their name. The database works the score out from
  the words (100 a letter × the multiplier) and refuses impossible lists (unknown letters, a word
  twice, a multiplier the word cannot have, more than 120 words) and a second round within 110
  seconds. It does not check the words against the word list. A save that fails is dropped
  silently; the game never waits for it.
- **Leaderboard:** the start menu's **Leaderboard** button opens the best score of each player in
  the game's language, on your own or against the bot (the top 20), this device's line outlined in
  yellow, and the box for the player's name.
- **Access:** the browser cannot read or write the tables; it can only call the two functions,
  which give out names and scores.
- **Limits:** nothing stops someone making many guests, and a guest who clears their browser's
  data starts again as a new one.

## Physics

- **Engine:** Matter.js.
- **Floor:** letters land on a floor and pile up. Piled letters can still be tapped. The pile never
  ends the game in v1.
- **Tiles:** round (pumpkins), so they roll and bounce.
- **Bad pumpkins:** about 1 tile in 10 is a grinning jack-o'-lantern (`src/images/bad.png`) with no
  letter; it cannot be tapped. When it first hits anything (the floor or another tile) it explodes
  with a flash, destroying every tile within about 2.6 tile radii and pushing the next ones away.
  Letters it destroys leave the word being built and score nothing.
- **Green pumpkins:** about 1 tile in 20 is a green pumpkin (`src/images/green.png`) with a
  letter. It cannot join a word: tapping it blows it up with the same blast as a bad pumpkin,
  destroying the tiles around it (letters it destroys leave the word and score nothing). It does
  not go off by itself, and the bot never picks it. In the 8-bit style it is a green block; at
  Christmas a lime bauble with a lit fuse.
- **Ghost pumpkins:** about 1 tile in 20 is a pale, see-through ghost pumpkin with a letter. It
  drifts straight down at a steady speed, through the other tiles and the floor, touching and
  moving nothing, and leaves the field at the bottom; bombs do not go off on it and blasts do not
  harm it. Tapping it uses it up: it vanishes at once and its letter joins the word being built
  (clearing the word loses it). It is drawn over the tiles it passes, and a tap on it takes it
  rather than the tile behind. The bot never picks it. In the 8-bit style it is a see-through
  white block; at Christmas a frosted see-through bauble.
- **Magic hats:** about 1 tile in 25 is a wizard's hat with no letter. It falls and rolls like any
  tile, and the moment it touches another tile (not the floor or a wall: there it waits) it
  vanishes in a burst of stars and gives every letter within a blast's reach a new, different
  letter: plain, ×2 and green pumpkins change; stars, bad pumpkins and ghosts do not. A changed
  letter stays in the word being built, with its new letter; a word the bot was about to try with
  it is dropped. A bomb that hits a hat destroys it first. Taps do nothing to it. The new letter
  follows from the round's seed, the tile's number and how many times it has changed
  (`changedLetter`). In the 8-bit style it is a blue block with a pixel hat; at Christmas a red
  elf's hat with white trim.
- **×2 pumpkins:** about 1 tile in 12 is a plain pumpkin (`src/images/pumpkin.svg`) with a letter
  and a gold ×2 mark. A correct word scores its letters times **2 × N**, N being the number of ×2
  pumpkins in it (one: ×2, two: ×4, three: ×6); the word bar shows the multiplier while the word
  holds one.
- **Jokers:** about 1 tile in 25 is a gold **star** (`src/images/star.svg`) with no letter.
  Tapping a falling star does not put it in the word: it leaves the field and goes into your
  **stock**, shown as a star button with a count at the start of the word row, under your avatar
  (greyed out at 0). Tapping that button (or pressing `*`) puts a star into the word, after the
  letters already picked, whenever you choose. It stands for any one letter: the word counts if
  some dictionary word fits it, and the status line names that word (e.g. C★T is "In the word
  list: CAT"). If several words fit, the first one not found yet is used, so C★T can score CAT,
  then COT, then CUT. A joker scores like any other letter. A star is spent only when its word
  scores; clearing the word gives it back. A word can hold at most **one** joker: tapping the
  button again shows "Only one star per word", and with an empty stock it says how to get one.
  Each round starts with **one** star in the stock, and it holds at most **3**: with a full stock
  a tapped star stays on the field and the game says "You can hold at most 3 stars". Stars on
  the field can still be blown up, and the bot never takes them.
- **Speed:** constant; no difficulty curve yet. Tiles enter one or two at a time, at random,
  0.9 seconds apart per tile on average.
- **Seeded tiles:** every tile's kind, letter and entry point come from the round's seed and the
  tile's number (`src/core/tiles.ts`). Offline the seed is random; online both players get the
  server's, so they see the same tiles.

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

- **Score:** 100 points per letter of the word (×2 tiles still multiply it).
- **Letter frequency:** weighted like real text in each language.
- **High score:** later.

## Look and sound

- Duolingo-inspired, dark only, the same on every device: a deep blue-grey background, the rounded
  bold font Nunito (Google Fonts; a system rounded font when offline), flat bright colours (green
  for the main action, blue for the second, yellow score, red for misses) and chunky buttons and
  choice cards with a solid bottom edge that presses down when tapped. Only the style is borrowed:
  no Duolingo name, owl or logo. The game field keeps its Halloween pumpkins and stars.
- **Styles:** Settings → **Style** picks Halloween (above, the default; called Classic before, and
  a saved Classic choice reads as Halloween), 8-bit or Christmas.
- **8-bit style:** the PICO-8 palette, the pixel font Press Start 2P, square corners and hard shadows, a plain navy
  background instead of the picture, square pixel tiles (orange letters, ×2 chip, purple ★ joker,
  red bomb tile with square sparks when it blows) and the timer ring in 16 blocks.
- **Christmas style:** a snowy night background, a string of coloured lights under the top bar,
  the display font Mountains of Christmas for words and titles, baubles for letters (red, green or
  blue with a gold cap; gold with a ×2 tag for ×2 letters), a gold star joker, a lump of coal for
  the bomb (it bursts into snow), gold and ice-blue glows for your and the bot's picks, a red
  bauble avatar for you and holly on the timer ring.
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
