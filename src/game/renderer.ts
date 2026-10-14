import type { Tile } from './physics';

const COLORS = {
  body: '#ff7a18',
  bodySelected: '#ffd23f',
  rib: 'rgba(120, 40, 0, 0.35)',
  stem: '#3f6b2a',
  letter: '#2a1300',
  glow: 'rgba(255, 210, 63, 0.8)',
};

/** Draws the tiles as simple pumpkins. Proper SVG artwork comes in a later PR. */
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
    ctx.fillStyle = tile.selected ? COLORS.bodySelected : COLORS.body;
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

    ctx.rotate(-tile.body.angle);
    ctx.fillStyle = COLORS.letter;
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.letter, 0, r * 0.06);
    ctx.restore();
  }
}
