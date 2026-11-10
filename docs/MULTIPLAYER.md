# WordFall online: player vs player

**Play vs player** on the start menu plays a 2-minute round against another person over the
internet: a **quick match** with whoever else is waiting in the same language, or **Play with a
friend**, which opens a private room with a 4-letter code (no I, L or O) for the friend to type in.

## How a round works

- **The same field for both.** The server picks a random seed; each tile's kind, letter and
  entry point follow from the seed and the tile's number (`tileSpec` in `src/core/tiles.ts`), so
  both players see the same letters fall in the same order. Each game runs its own physics, so
  positions are not shared and can drift apart (a different screen width, a bomb going off a
  moment earlier); nothing depends on them.
- **First come, first served.** A word goes to the server when the player checks it. The server
  scores it unless one of its tiles, or the word itself, was taken first; then the other player
  hears "Your opponent was faster". A scored word's tiles leave both fields, with the scorer's
  name and points rising over them in blue on the other side. Found words are shared, as against
  the bot.
- **You see the other player pick.** The tiles in their word being built glow blue on your field.
  You can still take them: whoever claims the word first gets the letters.
- **Stars** are handed out by the server too, so the same star cannot be taken twice. Each player
  starts with one and holds at most three; a word with a star from the stock spends it.
- **Bombs and green pumpkins** go off on each field separately.
- **No pause.** ☰ opens the menu but the round goes on behind it; starting another game, or
  closing the page, leaves the match, and the other player wins.
- The server's clock ends the round and decides the result: win, loss or draw, or "Your
  opponent left: you win!". A lost connection ends the round on your side with "Connection lost".

## Architecture

```
 browser (TypeScript, Vite)               server/ (ASP.NET Core, .NET 10)
 ┌────────────────────────┐   wss:// JSON  ┌───────────────────────────────┐
 │ src/net/match.ts       │ ─────────────▶ │ PlayerSession (one WebSocket) │
 │ src/net/protocol.ts    │ ◀───────────── │ Lobby: queue + rooms          │
 │ src/core/tiles.ts      │                │ Match: lock, clock, messages  │
 └────────────────────────┘                │ MatchState: the rules         │
                                           │ Tiles, WordList (data/)       │
                                           └───────────────────────────────┘
```

- **Transport:** plain WebSockets (`System.Net.WebSockets` in ASP.NET Core), JSON text frames.
  Only game events go over the wire (a pick, a word, a star), a few per second at most, never
  positions or physics, so JSON is plenty and a binary format would gain nothing.
- **The server is the referee.** It knows every tile from the seed (`server/WordFall.Server/Tiles.cs`
  ports `tileSpec` bit for bit) and loads the same word lists (`data/words_<lang>.txt`, cleaned
  the same way). For each word it checks that the tiles exist by now (at most one per 900 ms
  since the start, plus a little slack), are letters (not bombs, green pumpkins or stars), are
  untaken, spell the word (a star from the stock standing for any one letter) and that the word
  is in the list and not found yet; then it scores it (`src/core/scoring.ts`: 100 per letter,
  ×2 per ×2 tile) and tells both players. A player cannot score a word the game would not.
- `server/fixtures/tiles.json` holds tiles both sides must agree on; the game's tests
  (`src/core/tiles.test.ts`) and the server's (`TilesTests`) both check it. If the tile rules or
  letter weights change, change `Tiles.cs` too and regenerate the fixture.

### Messages

See `src/net/protocol.ts` (the game) and `server/WordFall.Server/Protocol.cs` (the server). Tiles
are named by their number in the round; `null` in a word is a star from the stock.

| From the game                          | From the server                                                |
| -------------------------------------- | -------------------------------------------------------------- |
| `quick {lang, name}`                   | `waiting`                                                      |
| `create {lang, name}`                  | `room {code}`                                                  |
| `join {code, lang, name}`              | `error {reason: noRoom \| language \| badRequest}`             |
|                                        | `start {seed, lang, durationMs, opponent, stars}`              |
| `pick {tiles}`                         | `pick {tiles}` (the other player's)                            |
| `star {tile}`                          | `star {by, tile, stars}`                                       |
| `word {id, tiles, word}`               | `claimed {by, id?, word, tiles, points, you, opponent, stars}` |
|                                        | `rejected {id?, reason: taken \| used \| invalid \| full}`     |
| `leave` (or just close the connection) | `end {you, opponent, reason: time \| left}`                    |

## Running it locally

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download) and Node.js.

```sh
dotnet run --project server/WordFall.Server   # http://localhost:8080, finds data/ by itself
npm run dev                                   # the game; in development it uses ws://localhost:8080/ws
dotnet test server/WordFall.slnx              # the server's tests
```

Open the game in two browser windows (one of them private, so they do not share anything) and
pick **Play with a friend** in one and type the code in the other.

## Deploying the server

The game is static (GitHub Pages); the server runs anywhere that runs a container or .NET, for
example a VPS or Yandex Cloud (Serverless Containers or a VM), close to the players.

```sh
docker build -f server/Dockerfile -t wordfall-server .   # from the repository root
docker run -p 8080:8080 wordfall-server
```

- It listens on plain HTTP on `PORT` (default 8080). Put it behind TLS: browsers on an `https://`
  page only connect to `wss://`. A reverse proxy (nginx, Caddy, or the cloud's load balancer)
  with a certificate in front is the usual way; it must pass WebSocket upgrades through.
- Settings (environment variables, or `appsettings.json` under `Multiplayer`):
  - `Multiplayer__DataPath`: the folder with `words_<lang>.txt` (the image sets `/app/data`).
  - `Multiplayer__AllowedOrigins__0`, `__1`, …: the pages allowed to connect, e.g.
    `https://ttds2024.github.io`. Unset, any page may connect.
- `GET /healthz` answers `{"status":"ok","matches":N}` for health checks.
- All matches live in one process's memory: run a single instance (it handles many matches;
  each is a few small messages per second). Restarting it ends the matches in progress.

Then point the game at it: in GitHub **Settings → Secrets and variables → Actions → Variables**
add `MULTIPLAYER_URL` = `wss://your-server/ws`; the next deploy shows **Play vs player**. For a
local build put `VITE_MULTIPLAYER_URL` in `.env.local`.

### Yandex Games

Yandex Games runs no server code, so the server is hosted as above. Its pages may only connect to
domains allowed in the game's **Content Security Policy**: in the Yandex Games developer console,
open the game's settings and add the server's domain (`wss://your-server`) to the CSP rules,
explaining that it is the multiplayer server. Add the game's page origin on Yandex Games to
`AllowedOrigins` too.

## Not yet

- Signing players in on the server (it trusts the name it is given; scores are not stored).
- Rematch in the same room, more than two players, ranked matchmaking.
- Reconnecting after a dropped connection.
