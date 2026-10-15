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
  star: '#ffc83d',
  starSelected: '#fff6d0',
  starEdge: '#b7791f',
};

/** Draws the tiles as simple pumpkins, skulls and joker stars. Proper SVG artwork comes in a later PR. */
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
      drawStar(ctx, r, tile.selected);
      ctx.restore();
      continue;
    }
    if (tile.kind === 'skull') drawSkull(ctx, r, tile.selected);
    else drawPumpkin(ctx, r, tile.selected);

    ctx.rotate(-tile.body.angle);
    ctx.fillStyle = tile.kind === 'skull' ? COLORS.socket : COLORS.letter;
    const size = tile.kind === 'skull' ? 0.9 : 1.05;
    ctx.font = `bold ${Math.round(r * size)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, tile.kind === 'skull' ? r * 0.12 : r * 0.06);
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

/** The joker: a five-pointed gold star filling the tile's circle, with no letter. */
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

/** A skull filling the tile's circle: round cranium, narrower jaw, eye sockets above the letter. */
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
