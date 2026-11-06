import { schema, t, type SchemaType } from '@colyseus/schema';

/** One player in the room. */
export const Player = schema(
  {
    /** Display name: the signed-in Yandex/VK name, or a default. */
    name: t.string(),
    score: t.uint32(),
    /** Words found this round. */
    words: t.uint16(),
    /** False while the player has dropped and may still reconnect. */
    connected: t.boolean().default(true),
    /** Asked for another round after the last one ended. */
    rematch: t.boolean().default(false),
  },
  'Player',
);
export type Player = SchemaType<typeof Player>;

export const WordfallState = schema(
  {
    /** A Phase (src/online/protocol.ts). */
    phase: t.string().default('waiting'),
    lang: t.string().default('ru'),
    /** Players the round needs before it starts. */
    seats: t.uint8().default(2),
    /**
     * Seed for the round's letters, new each round: a client that draws its letters from a
     * random generator seeded with it gets the same letters as everyone else.
     */
    seed: t.uint32(),
    /** Milliseconds left in the countdown or the round, updated every second. */
    timeLeftMs: t.uint32(),
    players: t.map(Player),
  },
  'WordfallState',
);
export type WordfallState = SchemaType<typeof WordfallState>;
