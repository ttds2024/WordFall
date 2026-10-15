export type RoundKind = 'timed' | 'endless';

/** Length of a timed round. */
export const TIMED_ROUND_MS = 5 * 60 * 1000;

/** Counts down a timed round; an endless round never ends. */
export class RoundTimer {
  private elapsed = 0;

  constructor(readonly kind: RoundKind) {}

  /** Milliseconds left, or undefined for an endless round. */
  get remaining(): number | undefined {
    return this.kind === 'timed' ? Math.max(0, TIMED_ROUND_MS - this.elapsed) : undefined;
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
