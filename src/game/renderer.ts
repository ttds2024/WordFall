import badUrl from '../images/bad.png';
import pumpkinSvg from '../images/pumpkin.svg?raw';
import starUrl from '../images/star.svg';
import type { Tile } from './physics';

const COLORS = {
  body: '#ff7a18',
  bodySelected: '#ffd23f',
  rib: 'rgba(120, 40, 0, 0.35)',
  stem: '#3f6b2a',
  letter: '#2a1300',
  glow: 'rgba(255, 210, 63, 0.8)',
  botGlow: 'rgba(28, 176, 246, 0.95)',
  badge: '#ffc800',
  badgeText: '#2a1300',
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
/** Width over height of src/images/bad.png (318 × 304). */
const BAD_ASPECT = 318 / 304;

/**
 * src/images/pumpkin.svg cropped to the pumpkin itself (its 800 × 600 page has wide margins),
 * with a size so it draws at full resolution.
 */
const DOUBLE_BOX = { x: 125, y: 48, width: 511, height: 437 };
const doubleUrl =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    pumpkinSvg.replace(
      'viewBox="0 0 800 600"',
      `viewBox="${DOUBLE_BOX.x} ${DOUBLE_BOX.y} ${DOUBLE_BOX.width} ${DOUBLE_BOX.height}" ` +
        `width="${DOUBLE_BOX.width}" height="${DOUBLE_BOX.height}"`,
    ),
  );

const pictures = new Map<string, HTMLImageElement>();

/** A picture once it has loaded; loading starts on first use. Until then tiles draw a stand-in. */
function picture(url: string): HTMLImageElement | undefined {
  let image = pictures.get(url);
  if (!image) {
    image = new Image();
    image.src = url;
    pictures.set(url, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : undefined;
}

/** Draws an image centred on the tile, `width` wide, keeping its aspect ratio. */
function drawCentred(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  aspect: number,
): void {
  const height = width / aspect;
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
}

/**
 * Draws the tiles: pumpkins with letters, ×2 pumpkins (src/images/pumpkin.svg) with a letter and
 * a ×2 badge, letterless bad pumpkins (src/images/bad.png) that explode, and joker stars.
 */
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
    if (tile.bot) drawBotRing(ctx, r);
    if (tile.kind === 'joker') {
      const image = picture(starUrl);
      if (image) drawStarImage(ctx, image, r, tile.selected);
      else drawStar(ctx, r, tile.selected);
      ctx.restore();
      continue;
    }
    if (tile.kind === 'bomb') {
      const image = picture(badUrl);
      if (image) drawCentred(ctx, image, r * 2.15, BAD_ASPECT);
      else drawPumpkin(ctx, r, false);
      ctx.restore();
      continue;
    }

    const double = tile.kind === 'double' ? picture(doubleUrl) : undefined;
    if (double) {
      if (tile.selected) drawHalo(ctx, r);
      ctx.shadowBlur = 0;
      drawCentred(ctx, double, r * 2.2, DOUBLE_BOX.width / DOUBLE_BOX.height);
    } else {
      drawPumpkin(ctx, r, tile.selected);
    }

    ctx.rotate(-tile.body.angle);
    ctx.fillStyle = COLORS.letter;
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, r * 0.14);
    if (tile.kind === 'double') drawDoubleBadge(ctx, r);
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

/** A glowing blue ring round a tile the bot has picked. */
function drawBotRing(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.botGlow;
  ctx.shadowColor = COLORS.botGlow;
  ctx.shadowBlur = r * 0.7;
  ctx.lineWidth = Math.max(3, r * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A pale glowing disc behind a selected picture tile. */
function drawHalo(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = COLORS.starHalo;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The ×2 tile's mark: a small gold disc with "×2" at its top right. */
function drawDoubleBadge(ctx: CanvasRenderingContext2D, r: number): void {
  const x = r * 0.72;
  const y = -r * 0.62;
  const size = r * 0.42;
  ctx.fillStyle = COLORS.badge;
  ctx.strokeStyle = COLORS.badgeText;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.badgeText;
  ctx.font = `900 ${Math.round(size * 1.05)}px system-ui, sans-serif`;
  ctx.fillText('×2', x, y + size * 0.05);
}

/** The joker's picture, filling the tile's circle, on a pale glowing halo when selected. */
function drawStarImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  r: number,
  selected: boolean,
): void {
  if (selected) drawHalo(ctx, r);
  ctx.shadowBlur = 0;
  drawCentred(ctx, image, r * 2, STAR_ASPECT);
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
