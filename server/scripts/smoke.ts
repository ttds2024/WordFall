/**
 * Plays a short match against a running server with two clients, in a private room so it never
 * meets real players: npm run smoke [-- wss://play.example.ru [ru|en]]
 */
import { Client, type Room } from '@colyseus/sdk';

const url = process.argv[2] ?? 'ws://localhost:2567';
const lang = process.argv[3] === 'en' ? 'en' : 'ru';
const words = lang === 'ru' ? ['слово', 'кот', 'дом', 'ткщ'] : ['word', 'cat', 'house', 'xqz'];

function waitFor(room: Room, check: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (check()) return resolve();
    room.onStateChange(() => check() && resolve());
  });
}

const client = new Client(url);
console.log(`Connecting to ${url}…`);
const anna = await client.create('wordfall', { lang, private: true, name: 'Анна' });
console.log(`Room ${anna.roomId} created`);
const boris = await client.joinById(anna.roomId, { name: 'Борис' });
for (const room of [anna, boris]) room.onMessage('found', () => {});

await waitFor(anna, () => anna.state.phase === 'playing');
console.log(`Round started, seed ${anna.state.seed}, ${anna.state.timeLeftMs / 1000} s`);

for (const [i, letters] of words.entries()) {
  const player = i % 2 === 0 ? anna : boris;
  const verdict = new Promise((resolve) => {
    const off = player.onMessage('verdict', (v) => (off(), resolve(v)));
  });
  player.send('submit', { letters: letters.toUpperCase(), doubles: 0 });
  console.log(`${letters.toUpperCase()}:`, JSON.stringify(await verdict));
}

await new Promise((resolve) => setTimeout(resolve, 200));
anna.state.players.forEach((p: { name: string; score: number }) =>
  console.log(`${p.name}: ${p.score}`),
);
await Promise.all([anna.leave(), boris.leave()]);
console.log('OK');
process.exit(0);
