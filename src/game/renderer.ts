import boneUrl from '../images/bone.png';
import type { Tile } from './physics';

const COLORS = {
  body: '#ff7a18',
  bodySelected: '#ffd23f',
  rib: 'rgba(120, 40, 0, 0.35)',
  stem: '#3f6b2a',
  letter: '#2a1300',
  glow: 'rgba(255, 210, 63, 0.8)',
  bone: '#e9e4d4',
  boneSelected: '#fff2b0',
  boneShade: 'rgba(60, 50, 70, 0.25)',
  socket: '#1a1424',
  halo: 'rgba(255, 210, 63, 0.85)',
  /** The light fill of bone.png. */
  skullBone: '#eaf5ff',
};

/** The skull picture is drawn this much wider than the tile so it fills the circle. */
const SKULL_SCALE = 2.15;
/** Where the letter sits on the skull picture: over the nose and jaw, as a fraction of its size. */
const SKULL_LETTER_Y = 0.27;

let skullImage: HTMLImageElement | undefined;

/** The skull picture (src/images/bone.png), once it has loaded; loading starts on first use. */
function loadedSkull(): HTMLImageElement | undefined {
  if (!skullImage) {
    skullImage = new Image();
    skullImage.src = boneUrl;
  }
  return skullImage.complete && skullImage.naturalWidth > 0 ? skullImage : undefined;
}

/** Draws the tiles as simple pumpkins and skulls. Proper SVG artwork comes in a later PR. */
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
    const image = tile.kind === 'skull' ? loadedSkull() : undefined;
    let letterY = r * 0.06;
    let letterSize = 1.05;
    if (image) {
      // The picture stays upright, like the letters, so the letter stays readable in the jaw.
      ctx.rotate(-tile.body.angle);
      drawSkullImage(ctx, image, r, tile.selected);
      letterY = r * SKULL_SCALE * SKULL_LETTER_Y;
      letterSize = 0.8;
    } else if (tile.kind === 'skull') {
      // Until the picture has loaded.
      drawSkull(ctx, r, tile.selected);
      letterY = r * 0.12;
      letterSize = 0.9;
    } else {
      drawPumpkin(ctx, r, tile.selected);
    }

    ctx.fillStyle = tile.kind === 'skull' ? COLORS.socket : COLORS.letter;
    ctx.font = `bold ${Math.round(r * letterSize)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!image) ctx.rotate(-tile.body.angle);
    if (image) {
      // A bone-coloured outline keeps the letter clear of the nose and teeth behind it.
      ctx.strokeStyle = COLORS.skullBone;
      ctx.lineWidth = r * 0.16;
      ctx.lineJoin = 'round';
      ctx.strokeText(tile.letter, 0, letterY);
    }
    ctx.fillText(tile.letter, 0, letterY);
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

/** The skull picture, crisp (it is pixel art), with a golden halo behind it when selected. */
function drawSkullImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  r: number,
  selected: boolean,
): void {
  if (selected) {
    ctx.fillStyle = COLORS.halo;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  const size = r * SKULL_SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
}

/** Fallback while the picture loads: a skull filling the tile's circle: round cranium, narrower jaw, eye sockets above the letter. */
function drawSkull(ctx: CanvasRenderingContext2D, r: number, selected: boolean): void {
  ctx.fillStyle = selected ? COLORS.boneSelected : COLORS.bone;
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

  // Eye sockets.
  ctx.fillStyle = COLORS.socket;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.36, -r * 0.42, r * 0.2, r * 0.16, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}
