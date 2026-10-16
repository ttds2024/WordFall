import starUrl from '../images/star.svg';
import type { Tile } from './physics';

const COLORS = {
  body: '#ff7a18',
  bodySelected: '#ffd23f',
  rib: 'rgba(120, 40, 0, 0.35)',
  stem: '#3f6b2a',
  letter: '#2a1300',
  glow: 'rgba(255, 210, 63, 0.8)',
  bone: '#e9e4d4',
  boneShade: 'rgba(60, 50, 70, 0.25)',
  socket: '#1a1424',
  star: '#ffc83d',
  starSelected: '#fff6d0',
  starEdge: '#b7791f',
  starHalo: 'rgba(255, 246, 208, 0.45)',
  flash: '255, 236, 160',
  fire: '255, 122, 24',
};

/** How long an explosion is drawn for. */
const BLAST_MS = 450;

/** An explosion being drawn: where, how far it reaches, and when it started. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  start: number;
}

/** Width over height of src/images/star.svg (its viewBox is 512 × 492.289). */
const STAR_ASPECT = 512 / 492.289;

let starImage: HTMLImageElement | undefined;

/** The joker's picture (src/images/star.svg), once loaded; loading starts on first use. */
function loadedStar(): HTMLImageElement | undefined {
  if (!starImage) {
    starImage = new Image();
    starImage.src = starUrl;
  }
  return starImage.complete && starImage.naturalWidth > 0 ? starImage : undefined;
}

/** Draws the tiles as simple pumpkins, letterless skulls and joker stars. Proper SVG artwork comes in a later PR. */
export function drawTiles(ctx: CanvasRenderingContext2D, tiles: readonly Tile[]): void {
  for (const tile of tiles) {
    const { x, y } = tile.body.position;
    const r = tile.body.circleRadius ?? 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tile.body.angle);

    if (tile.selected) {
      ctx.shadowColor = COLORS.glow;
      ctx.shadowBlur = r * 0.6;
    }
    if (tile.kind === 'joker') {
      const image = loadedStar();
      if (image) drawStarImage(ctx, image, r, tile.selected);
      else drawStar(ctx, r, tile.selected);
      ctx.restore();
      continue;
    }
    if (tile.kind === 'skull') {
      drawSkull(ctx, r);
      ctx.restore();
      continue;
    }
    drawPumpkin(ctx, r, tile.selected);

    ctx.rotate(-tile.body.angle);
    ctx.fillStyle = COLORS.letter;
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, r * 0.06);
    ctx.restore();
  }
}

function drawPumpkin(ctx: CanvasRenderingContext2D, r: number, selected: boolean): void {
  ctx.fillStyle = selected ? COLORS.bodySelected : COLORS.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = COLORS.rib;
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (const k of [-0.5, 0.5]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * Math.abs(k), r * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.stem;
  ctx.fillRect(-r * 0.1, -r * 1.12, r * 0.2, r * 0.28);
}

/** The joker's picture, filling the tile's circle, on a pale glowing halo when selected. */
function drawStarImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  r: number,
  selected: boolean,
): void {
  if (selected) {
    ctx.fillStyle = COLORS.starHalo;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  const width = r * 2;
  const height = width / STAR_ASPECT;
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
}

/** Stand-in while the picture loads: a five-pointed gold star filling the tile's circle. */
function drawStar(ctx: CanvasRenderingContext2D, r: number, selected: boolean): void {
  const inner = r * 0.48;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = selected ? COLORS.starSelected : COLORS.star;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.starEdge;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Draws explosions: a flash filling the blast, a ring racing outwards and sparks, all fading
 * over BLAST_MS. Returns the explosions still running.
 */
export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  blasts: readonly Blast[],
  now: number,
): Blast[] {
  const running = blasts.filter((blast) => now - blast.start < BLAST_MS);
  for (const blast of running) {
    const t = Math.max(0, now - blast.start) / BLAST_MS;
    const fade = 1 - t;
    const reach = blast.radius * (0.4 + 0.6 * Math.sqrt(t));
    ctx.save();
    ctx.translate(blast.x, blast.y);
    // Light adds up, so the flash glows on the dark field instead of muddying it.
    ctx.globalCompositeOperation = 'lighter';

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    glow.addColorStop(0, `rgba(${COLORS.flash}, ${0.9 * fade})`);
    glow.addColorStop(0.5, `rgba(${COLORS.fire}, ${0.6 * fade})`);
    glow.addColorStop(1, `rgba(${COLORS.fire}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${COLORS.flash}, ${fade})`;
    ctx.lineWidth = Math.max(2, blast.radius * 0.06 * fade);
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + blast.start;
      const from = reach * 0.75;
      const to = reach * (1.05 + 0.25 * (i % 2));
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * from, Math.sin(angle) * from);
      ctx.lineTo(Math.cos(angle) * to, Math.sin(angle) * to);
      ctx.stroke();
    }
    ctx.restore();
  }
  return running;
}

/** A skull filling the tile's circle: round cranium, narrower jaw, big eye sockets, a nose. */
function drawSkull(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = COLORS.bone;
  ctx.beginPath();
  ctx.arc(0, -r * 0.12, r * 0.88, Math.PI * 0.85, Math.PI * 0.15);
  ctx.lineTo(r * 0.5, r * 0.55);
  ctx.quadraticCurveTo(r * 0.5, r * 0.98, 0, r * 0.98);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.98, -r * 0.5, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cheekbone shading and teeth.
  ctx.strokeStyle = COLORS.boneShade;
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (const dx of [-0.2, 0, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(r * dx, r * 0.72);
    ctx.lineTo(r * dx, r * 0.95);
    ctx.stroke();
  }

  // Eye sockets and nose.
  ctx.fillStyle = COLORS.socket;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.34, -r * 0.2, r * 0.24, r * 0.21, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, r * 0.12);
  ctx.lineTo(r * 0.1, r * 0.36);
  ctx.lineTo(-r * 0.1, r * 0.36);
  ctx.closePath();
  ctx.fill();
}
