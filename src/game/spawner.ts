/** Releases a new tile at a constant rate while the screen has room for more. */
export class Spawner {
  private elapsed = 0;

  constructor(
    readonly intervalMs: number,
    readonly maxTiles: number,
  ) {}

  /** Advances time; returns how many tiles to spawn now, given how many are on screen. */
  update(ms: number, tileCount: number): number {
    this.elapsed += ms;
    let due = 0;
    while (this.elapsed >= this.intervalMs) {
      this.elapsed -= this.intervalMs;
      if (tileCount + due < this.maxTiles) due++;
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
