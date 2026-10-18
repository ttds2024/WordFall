/** A round on your own, or against the bot; both last ROUND_MS. */
export type RoundKind = 'solo' | 'bot';

/** Length of a round. */
export const ROUND_MS = 5 * 60 * 1000;

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

  /** Advances play time; returns true on the call that ends the round. */
  advance(ms: number): boolean {
    if (this.over) return false;
    this.elapsed += ms;
    return this.over;
  }
}

/** Formats milliseconds as m:ss, rounding up so 0:00 shows only when time is up. */
export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
