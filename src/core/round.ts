/** A round on your own, against the bot or against people online; all last ROUND_MS. */
export type RoundKind = 'solo' | 'bot' | 'online';

/** Length of a round: 2 minutes. */
export const ROUND_MS = 2 * 60 * 1000;

/** Counts a round down. */
export class RoundTimer {
  private elapsed = 0;

  constructor(readonly kind: RoundKind) {}

  /** Milliseconds left. */
  get remaining(): number {
    return Math.max(0, ROUND_MS - this.elapsed);
  }

  get over(): boolean {
    return this.remaining === 0;
  }

  /** Sets the time left, e.g. to the server's clock in an online round. */
  sync(remaining: number): void {
    this.elapsed = ROUND_MS - Math.min(Math.max(remaining, 0), ROUND_MS);
  }

  /** Advances play time; returns true on the call that ends the round. */
  advance(ms: number): boolean {
    if (this.over) return false;
    this.elapsed += ms;
    return this.over;
  }
}
