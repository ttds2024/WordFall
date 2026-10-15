import type { Language } from '../i18n';
import { pickLetter } from '../core/letters';
import { PhysicsWorld, type Tile } from './physics';
import { drawTiles } from './renderer';
import { maxTilesFor, Spawner, tileRadius } from './spawner';

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
const SPAWN_INTERVAL_MS = 900;

export interface GameHandlers {
  /** A tile was tapped. */
  onTap(tile: Tile): void;
  /** Called once per animation frame while running, with the frame time and the play time since the last frame. */
  onFrame?(now: number, elapsed: number): void;
}

/** Runs the falling-letter field on a canvas: spawning, physics, drawing and taps. */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: PhysicsWorld;
  private spawner: Spawner;
  private radius: number;
  private last = 0;
  private acc = 0;
  private frame = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private lang: Language,
    private readonly handlers: GameHandlers,
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
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  /** Empties the field, optionally switching to a new language's letters. */
  reset(lang: Language = this.lang): void {
    this.lang = lang;
    for (const tile of this.world.all()) this.world.remove(tile);
    this.draw();
  }

  removeTiles(tiles: readonly Tile[]): void {
    for (const tile of tiles) this.world.remove(tile);
  }

  private readonly tick = (now: number): void => {
    const elapsed = Math.min(now - this.last, MAX_FRAME_MS);
    this.acc += elapsed;
    this.last = now;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.spawnDue(STEP_MS);
      this.world.step(STEP_MS);
    }
    this.handlers.onFrame?.(now, elapsed);
    this.draw();
    if (this.running) this.frame = requestAnimationFrame(this.tick);
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
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const tile = this.world.tileAt(e.clientX - rect.left, e.clientY - rect.top, this.radius * 0.25);
    if (tile) this.handlers.onTap(tile);
  };

  private readonly handleResize = (): void => {
    const { width, height } = this.fitCanvas();
    this.world.resize(width, height);
    this.spawner = new Spawner(SPAWN_INTERVAL_MS, maxTilesFor(width, height, this.radius));
    this.draw();
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
