/**
 * Releases tiles in groups: `batch` tiles at once, every `batch` intervals, so the rate stays one
 * tile per interval on average. The first group comes one interval after the start, and no tile
 * comes more than `batch - 1` intervals before a one-at-a-time spawner would release it (the
 * multiplayer server allows for that: SpawnSlack in MatchState.cs).
 */
export class Spawner {
  private elapsed: number;

  constructor(
    readonly intervalMs: number,
    public maxTiles: number,
    readonly batch = 1,
  ) {
    this.elapsed = intervalMs * (batch - 1);
  }

  /** Advances time; returns how many tiles to spawn now, given how many are on screen. */
  update(ms: number, tileCount: number): number {
    const period = this.intervalMs * this.batch;
    this.elapsed += ms;
    let due = 0;
    while (this.elapsed >= period) {
      this.elapsed -= period;
      due += Math.max(0, Math.min(this.batch, this.maxTiles - tileCount - due));
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
