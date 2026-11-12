import badUrl from '../images/bad.png';
import greenUrl from '../images/green.png';
import pumpkinSvg from '../images/pumpkin.svg?raw';
import starUrl from '../images/star.svg';
import type { Theme } from '../settings';
import type { Tile } from './physics';

const COLORS = {
  body: '#ff7a18',
  /** A green pumpkin while its picture loads. */
  green: '#76a95a',
  ghost: '#eef3ff',
  ghostGlow: 'rgba(190, 215, 255, 0.9)',
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
  hat: '#4b2a8f',
  hatShade: '#2c1660',
  hatBand: '#ffc83d',
  magic: ['#ffe066', '#c9a2ff', '#7fe3ff', '#ffffff'],
};

/** How solid a ghost looks: the tiles behind it show through. */
const GHOST_ALPHA = 0.72;

/** How long an explosion is drawn for. */
const BLAST_MS = 450;

/** An explosion being drawn: where, how far it reaches, and when it started. */
export interface Blast {
  x: number;
  y: number;
  radius: number;
  start: number;
  /** A magic hat's spell rather than a blast: a burst of stars. */
  magic?: boolean;
}

/** Width over height of src/images/star.svg (its viewBox is 512 × 492.289). */
const STAR_ASPECT = 512 / 492.289;
/** Width over height of src/images/bad.png (318 × 304). */
const BAD_ASPECT = 318 / 304;
/** src/images/green.png is square; its stem takes the top fifth, so the body sits low. */
const GREEN_LETTER_DROP = 0.3;

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
 * a ×2 badge, letterless bad pumpkins (src/images/bad.png) that explode, green pumpkins
 * (src/images/green.png) with a letter that explode when tapped, pale see-through ghost pumpkins
 * with a letter, letterless magic hats that change the letters they touch, and joker stars. In the 8-bit style they are square pixel blocks instead, and at
 * Christmas baubles, a gold star and coal. Ghosts are drawn last, over the tiles they pass through.
 */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: readonly Tile[],
  theme: Theme = 'halloween',
): void {
  tiles = [
    ...tiles.filter((tile) => tile.kind !== 'ghost'),
    ...tiles.filter((tile) => tile.kind === 'ghost'),
  ];
  if (theme === '8bit') {
    for (const tile of tiles) drawPixelTile(ctx, tile);
    return;
  }
  if (theme === 'christmas') {
    for (const tile of tiles) drawChristmasTile(ctx, tile);
    return;
  }
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

    if (tile.kind === 'ghost') {
      drawGhost(ctx, r, tile.letter);
      ctx.restore();
      continue;
    }
    if (tile.kind === 'hat') {
      drawHat(ctx, r, COLORS.hat, COLORS.hatShade, COLORS.hatBand);
      ctx.restore();
      continue;
    }

    const double = tile.kind === 'double' ? picture(doubleUrl) : undefined;
    const green = tile.kind === 'green' ? picture(greenUrl) : undefined;
    if (double) {
      if (tile.selected) drawHalo(ctx, r);
      ctx.shadowBlur = 0;
      drawCentred(ctx, double, r * 2.2, DOUBLE_BOX.width / DOUBLE_BOX.height);
    } else if (green) {
      drawCentred(ctx, green, r * 2.3, 1);
    } else {
      drawPumpkin(ctx, r, tile.selected, tile.kind === 'green' ? COLORS.green : undefined);
    }

    ctx.rotate(-tile.body.angle);
    ctx.fillStyle = COLORS.letter;
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, r * (green ? GREEN_LETTER_DROP : 0.14));
    if (tile.kind === 'double') drawDoubleBadge(ctx, r);
    ctx.restore();
  }
}

function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  r: number,
  selected: boolean,
  body: string = COLORS.body,
): void {
  ctx.fillStyle = selected ? COLORS.bodySelected : body;
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

/** A ghost pumpkin: pale, glowing and see-through, with a fading trail above it. */
function drawGhost(ctx: CanvasRenderingContext2D, r: number, letter: string): void {
  ctx.fillStyle = COLORS.ghost;
  for (const [lift, size, alpha] of [
    [1.5, 0.55, 0.12],
    [0.8, 0.8, 0.22],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(0, -r * lift, r * size, r * size * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.shadowColor = COLORS.ghostGlow;
  ctx.shadowBlur = r * 0.7;
  drawPumpkin(ctx, r, false, COLORS.ghost);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.letter;
  ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 0, r * 0.14);
}

/** A magic hat: a tall pointed wizard's hat with a wide brim, a band and a few stars. */
function drawHat(
  ctx: CanvasRenderingContext2D,
  r: number,
  fill: string,
  shade: string,
  band: string,
): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  // The brim.
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.98, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // The cone, its tip bent to one side.
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.58);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.3, r * 0.3, -r * 0.98);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.2, r * 0.6, r * 0.58);
  ctx.quadraticCurveTo(0, r * 0.82, -r * 0.6, r * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The band.
  ctx.strokeStyle = band;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.52, r * 0.42);
  ctx.quadraticCurveTo(0, r * 0.62, r * 0.52, r * 0.42);
  ctx.stroke();
  ctx.fillStyle = band;
  for (const [sx, sy, size] of [
    [-0.08, -0.05, 0.2],
    [0.2, -0.5, 0.13],
    [-0.75, -0.55, 0.14],
    [0.78, -0.2, 0.11],
  ] as const) {
    sparkle(ctx, r * sx, r * sy, r * size);
  }
}

/** A four-pointed twinkle centred at (x, y). */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? size : size * 0.3;
    const angle = (i * Math.PI) / 4;
    ctx.lineTo(x + Math.sin(angle) * radius, y - Math.cos(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

/** A magic hat's spell: twinkles flying out to its reach and fading, in the given colours. */
function drawSpell(
  ctx: CanvasRenderingContext2D,
  blast: Blast,
  now: number,
  colors: readonly string[],
): void {
  const t = Math.max(0, now - blast.start) / BLAST_MS;
  const reach = blast.radius * (0.25 + 0.75 * Math.sqrt(t));
  const size = Math.max(2, (blast.radius / 6) * (1 - t * 0.5));
  ctx.save();
  ctx.translate(blast.x, blast.y);
  ctx.globalAlpha = 1 - t * t;
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + blast.start;
    const distance = reach * (i % 2 === 0 ? 1 : 0.6);
    ctx.fillStyle = colors[i % colors.length]!;
    sparkle(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance, size);
  }
  ctx.restore();
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
 * over BLAST_MS (in the 8-bit style square sparks flying out, at Christmas a burst of snow).
 * Returns the explosions still running.
 */
export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  blasts: readonly Blast[],
  now: number,
  theme: Theme = 'halloween',
): Blast[] {
  const all = blasts.filter((blast) => now - blast.start < BLAST_MS);
  const spellColors =
    theme === '8bit' ? PIXEL.sparks : theme === 'christmas' ? XMAS.snow : COLORS.magic;
  for (const blast of all) if (blast.magic) drawSpell(ctx, blast, now, spellColors);
  const running = all.filter((blast) => !blast.magic);
  if (theme === '8bit') {
    for (const blast of running) drawPixelBlast(ctx, blast, now);
    return all;
  }
  if (theme === 'christmas') {
    for (const blast of running) drawSnowBlast(ctx, blast, now);
    return all;
  }
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
  return all;
}

/** The 8-bit style's colours (the PICO-8 palette). */
const PIXEL = {
  edge: '#000000',
  you: '#ffec27',
  bot: '#29adff',
  ink: '#000000',
  white: '#fff1e8',
  letter: { fill: '#ffa300', shade: '#ab5236', light: '#ffcc80' },
  joker: { fill: '#83769c', shade: '#5f574f', light: '#c2c3c7' },
  bomb: { fill: '#ff004d', shade: '#7e2553', light: '#ff77a8' },
  hat: { fill: '#29adff', shade: '#1d2b53', light: '#c2c3c7' },
  green: { fill: '#00e436', shade: '#008751', light: '#a8ffb8' },
  ghost: { fill: '#fff1e8', shade: '#83769c', light: '#ffffff' },
  sparks: ['#ffec27', '#ffa300', '#ff004d', '#fff1e8'],
};

/** Fills a square with its corners notched, the way pixel art rounds them. */
function notchedSquare(ctx: CanvasRenderingContext2D, half: number, notch: number): void {
  ctx.fillRect(-half + notch, -half, half * 2 - notch * 2, half * 2);
  ctx.fillRect(-half, -half + notch, half * 2, half * 2 - notch * 2);
}

/**
 * An 8-bit tile: a square block, upright whatever the body's spin, with a bevel and a frame
 * (yellow when you picked it, blue when the bot did). Letters orange (green for the ones that
 * explode when tapped, white and see-through for ghosts), ×2 with a chip, the joker purple with
 * ★, the bomb red with a pixel bomb.
 */
function drawPixelTile(ctx: CanvasRenderingContext2D, tile: Tile): void {
  const { x, y } = tile.body.position;
  const r = tile.body.circleRadius ?? 0;
  const half = Math.round(r * 0.9);
  const px = Math.max(2, Math.round(r / 8));
  const look =
    tile.kind === 'joker'
      ? PIXEL.joker
      : tile.kind === 'bomb'
        ? PIXEL.bomb
        : tile.kind === 'hat'
          ? PIXEL.hat
          : tile.kind === 'green'
            ? PIXEL.green
            : tile.kind === 'ghost'
              ? PIXEL.ghost
              : PIXEL.letter;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (tile.kind === 'ghost') ctx.globalAlpha = GHOST_ALPHA;
  ctx.fillStyle = tile.selected ? PIXEL.you : tile.bot ? PIXEL.bot : PIXEL.edge;
  notchedSquare(ctx, half, px * 2);
  const inner = half - px * (tile.selected || tile.bot ? 2 : 1);
  ctx.fillStyle = look.shade;
  ctx.fillRect(-inner, -inner, inner * 2, inner * 2);
  ctx.fillStyle = look.light;
  ctx.fillRect(-inner, -inner, inner * 2 - px, inner * 2 - px);
  ctx.fillStyle = look.fill;
  ctx.fillRect(-inner + px, -inner + px, inner * 2 - px * 2, inner * 2 - px * 2);

  if (tile.kind === 'bomb') {
    drawPixelBomb(ctx, px);
  } else if (tile.kind === 'hat') {
    drawPixelHat(ctx, px);
  } else {
    ctx.fillStyle = tile.kind === 'joker' ? PIXEL.white : PIXEL.ink;
    ctx.font = `${Math.round(r * 0.8)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, px / 2);
  }
  if (tile.kind === 'double') {
    const size = Math.round(r * 0.36);
    ctx.fillStyle = PIXEL.you;
    ctx.fillRect(inner - size * 2, -inner, size * 2, size * 1.4);
    ctx.fillStyle = PIXEL.ink;
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.fillText('×2', inner - size, -inner + size * 0.75);
  }
  ctx.restore();
}

/** A round black bomb with a lit fuse, drawn in squares `px` wide. */
function drawPixelBomb(ctx: CanvasRenderingContext2D, px: number): void {
  const p = px * 1.5;
  const cells: [number, number, number, number, string][] = [
    [1, -4, 1, 1, PIXEL.you],
    [0, -3, 1, 1, PIXEL.letter.fill],
    [-2, -2, 3, 1, PIXEL.ink],
    [-3, -1, 5, 4, PIXEL.ink],
    [-2, 3, 3, 1, PIXEL.ink],
    [-2, -1, 1, 1, PIXEL.white],
  ];
  for (const [cx, cy, w, h, color] of cells) {
    ctx.fillStyle = color;
    ctx.fillRect(cx * p, cy * p, w * p, h * p);
  }
}

/** A pointed wizard's hat with a yellow band and star, drawn in squares `px` wide. */
function drawPixelHat(ctx: CanvasRenderingContext2D, px: number): void {
  const p = px * 1.5;
  const cells: [number, number, number, number, string][] = [
    [0, -4, 1, 1, PIXEL.hat.shade],
    [-1, -3, 2, 1, PIXEL.hat.shade],
    [-1, -2, 3, 1, PIXEL.hat.shade],
    [-2, -1, 4, 2, PIXEL.hat.shade],
    [-2, 1, 4, 1, PIXEL.you],
    [-4, 2, 8, 1, PIXEL.hat.shade],
    [0, -1, 1, 1, PIXEL.you],
  ];
  for (const [cx, cy, w, h, color] of cells) {
    ctx.fillStyle = color;
    ctx.fillRect(cx * p, cy * p, w * p, h * p);
  }
}

/** An 8-bit explosion: square sparks flying out and shrinking. */
function drawPixelBlast(ctx: CanvasRenderingContext2D, blast: Blast, now: number): void {
  const t = Math.max(0, now - blast.start) / BLAST_MS;
  const reach = blast.radius * (0.3 + 0.7 * t);
  const size = Math.max(2, Math.round((blast.radius / 8) * (1 - t)));
  ctx.save();
  ctx.translate(Math.round(blast.x), Math.round(blast.y));
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const distance = reach * (i % 2 === 0 ? 1 : 0.65);
    ctx.fillStyle = PIXEL.sparks[i % PIXEL.sparks.length]!;
    ctx.fillRect(
      Math.round(Math.cos(angle) * distance) - size,
      Math.round(Math.sin(angle) * distance) - size,
      size * 2,
      size * 2,
    );
  }
  ctx.restore();
}

/** The Christmas style's colours. */
const XMAS = {
  baubles: [
    { fill: '#d7263d', shade: '#8e1426', ink: '#fff6e5' },
    { fill: '#1f8a4c', shade: '#145c33', ink: '#fff6e5' },
    { fill: '#2e6fa3', shade: '#1d4f73', ink: '#fff6e5' },
  ],
  gold: { fill: '#f2c14e', shade: '#b8862b', ink: '#3a2a00' },
  /** The bauble that explodes when tapped: lime, with a lit fuse on its cap. */
  lime: { fill: '#9be564', shade: '#4f8a2a', ink: '#173300' },
  /** The ghost: a frosted, see-through bauble. */
  frost: { fill: '#eef6fc', shade: '#a9c4d8', ink: '#1d4f73' },
  /** The magic hat: a red elf's hat with white trim here. */
  hat: { fill: '#d7263d', shade: '#8e1426', trim: '#fff6e5' },
  cap: '#f2c14e',
  capShade: '#b8862b',
  shine: 'rgba(255, 255, 255, 0.55)',
  you: '#f2c14e',
  bot: '#7cc6ff',
  tag: '#fff6e5',
  tagInk: '#8e1426',
  coal: '#2b2b33',
  coalEdge: '#15151a',
  fuse: '#c9b28a',
  spark: '#ffb627',
  snow: ['#ffffff', '#e8f1f8', '#f2c14e'],
};

/**
 * A Christmas tile, hanging upright whatever the body's spin: a bauble with a gold cap and a
 * shine (red, green or blue; gold with a ×2 tag for ×2 letters; lime with a lit fuse for the ones
 * that explode when tapped; frosted and see-through for ghosts), the joker as a gold star and the bomb as a lump of coal with a lit fuse. Your picks glow gold, the bot's ice blue.
 */
function drawChristmasTile(ctx: CanvasRenderingContext2D, tile: Tile): void {
  const { x, y } = tile.body.position;
  const r = tile.body.circleRadius ?? 0;
  ctx.save();
  ctx.translate(x, y);
  if (tile.selected || tile.bot) {
    ctx.shadowColor = tile.selected ? XMAS.you : XMAS.bot;
    ctx.shadowBlur = r * 0.8;
  }
  if (tile.kind === 'joker') {
    drawStarShape(ctx, r * 1.05, XMAS.gold.fill, XMAS.gold.shade);
  } else if (tile.kind === 'bomb') {
    drawCoal(ctx, r);
  } else if (tile.kind === 'hat') {
    ctx.shadowBlur = 0;
    drawHat(ctx, r, XMAS.hat.fill, XMAS.hat.shade, XMAS.hat.trim);
  } else {
    if (tile.kind === 'ghost') ctx.globalAlpha = GHOST_ALPHA;
    drawBauble(ctx, tile, r);
  }
  ctx.restore();
}

function drawBauble(ctx: CanvasRenderingContext2D, tile: Tile, r: number): void {
  const look =
    tile.kind === 'double'
      ? XMAS.gold
      : tile.kind === 'green'
        ? XMAS.lime
        : tile.kind === 'ghost'
          ? XMAS.frost
          : XMAS.baubles[tile.body.id % XMAS.baubles.length]!;
  const ball = r * 0.9;
  const cy = r * 0.1;
  if (tile.selected || tile.bot) {
    ctx.fillStyle = tile.selected ? XMAS.you : XMAS.bot;
    ctx.beginPath();
    ctx.arc(0, cy, ball + Math.max(2, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = XMAS.cap;
  ctx.fillRect(-r * 0.22, cy - ball - r * 0.2, r * 0.44, r * 0.26);
  ctx.fillStyle = XMAS.capShade;
  ctx.fillRect(-r * 0.22, cy - ball, r * 0.44, r * 0.06);
  if (tile.kind === 'green') drawFuse(ctx, cy - ball - r * 0.2, r);

  ctx.fillStyle = look.shade;
  ctx.beginPath();
  ctx.arc(0, cy, ball, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.fill;
  ctx.beginPath();
  ctx.arc(-ball * 0.07, cy - ball * 0.09, ball * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = XMAS.shine;
  ctx.beginPath();
  ctx.ellipse(-ball * 0.42, cy - ball * 0.45, ball * 0.24, ball * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = look.ink;
  ctx.font = `900 ${Math.round(r * 0.95)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tile.letter, 0, cy + r * 0.06);

  if (tile.kind === 'double') {
    const size = r * 0.36;
    const tx = ball * 0.78;
    const ty = cy - ball * 0.72;
    ctx.fillStyle = XMAS.tag;
    ctx.strokeStyle = XMAS.tagInk;
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.roundRect(tx - size * 1.1, ty - size * 0.7, size * 2.2, size * 1.4, size * 0.7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = XMAS.tagInk;
    ctx.font = `900 ${Math.round(size * 1.1)}px Nunito, system-ui, sans-serif`;
    ctx.fillText('×2', tx, ty + size * 0.05);
  }
}

/** A five-pointed star filling a circle of radius r. */
function drawStarShape(ctx: CanvasRenderingContext2D, r: number, fill: string, edge: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** A lumpy piece of coal with a fuse and its spark. */
function drawCoal(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.strokeStyle = XMAS.fuse;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.6);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.0, r * 0.4, -r * 1.05);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = XMAS.spark;
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 1.05, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = XMAS.coal;
  ctx.strokeStyle = XMAS.coalEdge;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  const bumps = 9;
  for (let i = 0; i <= bumps; i++) {
    const angle = (i / bumps) * Math.PI * 2;
    const radius = r * (i % 2 === 0 ? 0.88 : 0.76);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius + r * 0.08);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A short lit fuse rising from `top` (a bauble's cap). */
function drawFuse(ctx: CanvasRenderingContext2D, top: number, r: number): void {
  ctx.strokeStyle = XMAS.fuse;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.quadraticCurveTo(r * 0.05, top - r * 0.25, r * 0.28, top - r * 0.3);
  ctx.stroke();
  ctx.fillStyle = XMAS.spark;
  ctx.beginPath();
  ctx.arc(r * 0.3, top - r * 0.3, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** A Christmas explosion: flakes of snow and gold flying out and fading. */
function drawSnowBlast(ctx: CanvasRenderingContext2D, blast: Blast, now: number): void {
  const t = Math.max(0, now - blast.start) / BLAST_MS;
  const reach = blast.radius * (0.3 + 0.7 * Math.sqrt(t));
  const size = Math.max(1.5, (blast.radius / 10) * (1 - t * 0.6));
  ctx.save();
  ctx.translate(blast.x, blast.y);
  ctx.globalAlpha = 1 - t;
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + blast.start;
    const distance = reach * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.75 : 0.5);
    ctx.fillStyle = XMAS.snow[i % XMAS.snow.length]!;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
