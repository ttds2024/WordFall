import type { Language } from '../i18n';
import { pickLetter } from '../core/letters';
import { PhysicsWorld, type Tile } from './physics';
import { drawTiles } from './renderer';
import { maxTilesFor, Spawner, tileRadius } from './spawner';

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
const SPAWN_INTERVAL_MS = 900;

/** Runs the falling-letter field on a canvas: spawning, physics, drawing and taps. */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: PhysicsWorld;
  private spawner: Spawner;
  private radius: number;
  private last = 0;
  private acc = 0;
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly lang: Language,
    private readonly onTap: (tile: Tile) => void = (tile) => (tile.selected = !tile.selected),
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    const { width, height } = this.fitCanvas();
    this.world = new PhysicsWorld(width, height);
    this.radius = tileRadius(width);
    this.spawner = new Spawner(SPAWN_INTERVAL_MS, maxTilesFor(width, height, this.radius));

    canvas.addEventListener('pointerdown', this.handlePointer);
    new ResizeObserver(this.handleResize).observe(canvas);
  }

  start(): void {
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
  }

  private readonly tick = (now: number): void => {
    this.acc += Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.spawnDue(STEP_MS);
      this.world.step(STEP_MS);
    }
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  private spawnDue(ms: number): void {
    const due = this.spawner.update(ms, this.world.count);
    const { width } = this.world.size;
    const r = this.radius;
    for (let i = 0; i < due; i++) {
      const x = r + Math.random() * Math.max(0, width - 2 * r);
      this.world.spawn(pickLetter(this.lang), x, -r - i * r * 2.2, r);
    }
  }

  private draw(): void {
    const { width, height } = this.world.size;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    drawTiles(this.ctx, this.world.all());
  }

  private readonly handlePointer = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const tile = this.world.tileAt(e.clientX - rect.left, e.clientY - rect.top, this.radius * 0.25);
    if (tile) this.onTap(tile);
  };

  private readonly handleResize = (): void => {
    const { width, height } = this.fitCanvas();
    this.world.resize(width, height);
    this.spawner = new Spawner(SPAWN_INTERVAL_MS, maxTilesFor(width, height, this.radius));
  };

  /** Matches the canvas backing store to its CSS size and pixel ratio. */
  private fitCanvas(): { width: number; height: number } {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    return { width, height };
  }
}
