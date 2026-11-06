/** A random number generator: returns numbers in [0, 1), like Math.random. */
export type Random = () => number;

/**
 * A seeded generator (mulberry32): the same seed gives the same numbers on every device, so
 * players in an online match get their letters in the same order.
 */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
