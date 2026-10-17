/** How long the floating word and points stay on screen; matches the CSS animation. */
export const FLOAT_MS = 1200;
/** Keeps the label this far from the field's sides so it is never cut off. */
const EDGE = 70;

/**
 * Where a found word's label starts: the middle of its tiles, kept inside the field and below
 * its top so it has room to rise.
 */
export function floatPosition(
  points: readonly { x: number; y: number }[],
  width: number,
  height: number,
): { x: number; y: number } {
  const n = Math.max(points.length, 1);
  const x = points.reduce((sum, p) => sum + p.x, 0) / n;
  const y = points.reduce((sum, p) => sum + p.y, 0) / n;
  return {
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, width - EDGE)),
    y: Math.min(Math.max(y, 90), Math.max(90, height - 30)),
  };
}

/**
 * Shows a found word with its points where its tiles were; it rises and fades out, then removes
 * itself.
 */
export function showScoreFloat(
  container: HTMLElement,
  at: { x: number; y: number },
  word: string,
  points: number,
  multiplier: number,
): void {
  const label = document.createElement('div');
  label.className = 'score-float';
  label.style.left = `${at.x}px`;
  label.style.top = `${at.y}px`;
  label.setAttribute('aria-hidden', 'true');

  const value = document.createElement('b');
  value.className = 'score-float-points';
  value.textContent = `+${points}${multiplier > 1 ? ` ×${multiplier}` : ''}`;
  const text = document.createElement('span');
  text.className = 'score-float-word';
  text.textContent = word;
  label.append(value, text);

  container.append(label);
  // animationend can be skipped (e.g. a hidden tab), so a timer makes sure it goes.
  const remove = (): void => label.remove();
  label.addEventListener('animationend', remove);
  window.setTimeout(remove, FLOAT_MS + 200);
}

/** Makes the score bounce when it goes up. */
export function bumpScore(score: HTMLElement): void {
  score.classList.remove('bump');
  void score.offsetWidth; // restart the animation if it is already running
  score.classList.add('bump');
}
