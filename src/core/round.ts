/** A round on your own, against the bot, or against a friend (a match); all last ROUND_MS. */
export type RoundKind = 'solo' | 'bot' | 'match';

/** Length of a round: 2 minutes. */
export const ROUND_MS = 2 * 60 * 1000;

/** Counts a round down. */
export class RoundTimer {
  private elapsed = 0;
  private readonly startAt: number;

  /**
   * Without a clock the round lasts ROUND_MS of play time, as given to advance(), so it can be
   * paused. With one (a match) it starts `delay` ms from now and ends ROUND_MS later by that
   * clock whatever happens to the game meanwhile, so both players' rounds end together.
   */
  constructor(
    readonly kind: RoundKind,
    private readonly clock?: () => number,
    delay = 0,
  ) {
    this.startAt = clock ? clock() + delay : 0;
  }

  /** Milliseconds left. */
  get remaining(): number {
    return Math.max(0, ROUND_MS - this.elapsed);
  }

  get over(): boolean {
    return this.remaining === 0;
  }

  /** Advances play time (or reads the clock); returns true on the call that ends the round. */
  advance(ms: number): boolean {
    if (this.over) return false;
    this.elapsed = this.clock ? Math.max(0, this.clock() - this.startAt) : this.elapsed + ms;
    return this.over;
  }
}
