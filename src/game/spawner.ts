/**
 * Releases tiles in groups of a random size, from 1 to `maxBatch`, and waits one interval per tile
 * of a group before the next, so the rate stays one tile per interval on average. The first group
 * comes one interval after the start, and no tile comes more than `maxBatch - 1` intervals before
 * a one-at-a-time spawner would release it (the multiplayer server allows for that: SpawnSlack in
 * MatchState.cs).
 */
export class Spawner {
  private elapsed = 0;
  private wait: number;

  constructor(
    readonly intervalMs: number,
    public maxTiles: number,
    readonly maxBatch = 1,
    /** Picks the group sizes: numbers in [0, 1). */
    private readonly random: () => number = Math.random,
  ) {
    this.wait = intervalMs;
  }

  /** Advances time; returns how many tiles to spawn now, given how many are on screen. */
  update(ms: number, tileCount: number): number {
    this.elapsed += ms;
    let due = 0;
    while (this.elapsed >= this.wait) {
      this.elapsed -= this.wait;
      const size = 1 + Math.floor(this.random() * this.maxBatch);
      const count = Math.max(0, Math.min(size, this.maxTiles - tileCount - due));
      due += count;
      this.wait = this.intervalMs * Math.max(1, count);
    }
    return due;
  }
}

/** Tile radius for a play area: about 7 tiles across, within finger-friendly limits. */
export function tileRadius(width: number): number {
  return Math.min(Math.max(width / 14, 22), 40);
}

/** Roughly how many tiles fill the lower two thirds of the area. */
export function maxTilesFor(width: number, height: number, radius: number): number {
  const perTile = (radius * 2) ** 2;
  return Math.max(8, Math.floor(((width * height) / perTile) * (2 / 3)));
}
