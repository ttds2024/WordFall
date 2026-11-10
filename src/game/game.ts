import type { Language } from '../i18n';
import type { Theme } from '../settings';
import { pickLetter } from '../core/letters';
import { JOKER } from '../core/word';
import { PhysicsWorld, type Explosion, type Tile } from './physics';
import { drawExplosions, drawTiles, type Blast } from './renderer';
import { maxTilesFor, Spawner, tileRadius } from './spawner';

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
const SPAWN_INTERVAL_MS = 900;
/** Share of falling tiles that are bombs (no letter; they explode when they hit something). */
export const BOMB_CHANCE = 0.1;
/** Share of falling tiles that are ×2 letters. */
export const DOUBLE_CHANCE = 0.08;
/** Share of falling tiles that are green pumpkins (a letter; they explode when tapped). */
export const GREEN_CHANCE = 0.05;
/** Share of falling tiles that are jokers. */
export const JOKER_CHANCE = 0.04;

export interface GameHandlers {
  /** A tile was tapped. */
  onTap(tile: Tile): void;
  /** The field was tapped away from any tile. */
  onTapEmpty(): void;
  /** A bomb or green pumpkin exploded and destroyed these tiles. */
  onExplode?(destroyed: Tile[]): void;
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
  /** Explosions still being drawn. */
  private blasts: Blast[] = [];
  /** How the tiles look. */
  private theme: Theme = 'halloween';
  /** Decides what falls and where; seeded in a match, so both players get the same tiles. */
  private random: () => number = Math.random;

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

  /**
   * Empties the field, optionally switching to a new language's letters. `random` decides what
   * falls from now on: the same generator gives the same tiles in the same order.
   */
  reset(lang: Language = this.lang, random: () => number = Math.random): void {
    this.lang = lang;
    this.random = random;
    this.acc = 0;
    this.spawner = new Spawner(SPAWN_INTERVAL_MS, this.spawner.maxTiles);
    for (const tile of this.world.all()) this.world.remove(tile);
    this.blasts = [];
    this.draw();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.draw();
  }

  /** The tiles on the field. */
  tiles(): Tile[] {
    return this.world.all();
  }

  removeTiles(tiles: readonly Tile[]): void {
    for (const tile of tiles) this.world.remove(tile);
  }

  /** Blows up a tile (a tapped green pumpkin) and the tiles around it. */
  explode(tile: Tile): void {
    if (!this.world.all().includes(tile)) return;
    this.showExplosion(this.world.explode(tile), performance.now());
  }

  private showExplosion(explosion: Explosion, now: number): void {
    this.blasts.push({ x: explosion.x, y: explosion.y, radius: explosion.radius, start: now });
    if (explosion.destroyed.length > 0) this.handlers.onExplode?.(explosion.destroyed);
  }

  private readonly tick = (now: number): void => {
    const elapsed = Math.min(now - this.last, MAX_FRAME_MS);
    this.acc += elapsed;
    this.last = now;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.spawnDue(STEP_MS);
      for (const explosion of this.world.step(STEP_MS)) this.showExplosion(explosion, now);
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
      const random = this.random;
      const x = r + random() * Math.max(0, width - 2 * r);
      const y = -r - i * r * 2.2;
      const roll = random();
      const letter = (): string => pickLetter(this.lang, random);
      if (roll < JOKER_CHANCE) this.world.spawn(JOKER, x, y, r, 'joker');
      else if (roll < JOKER_CHANCE + BOMB_CHANCE) this.world.spawn('', x, y, r, 'bomb');
      else if (roll < JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE) {
        this.world.spawn(letter(), x, y, r, 'double');
      } else if (roll < JOKER_CHANCE + BOMB_CHANCE + DOUBLE_CHANCE + GREEN_CHANCE) {
        this.world.spawn(letter(), x, y, r, 'green');
      } else this.world.spawn(letter(), x, y, r);
    }
  }

  private draw(): void {
    const { width, height } = this.world.size;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    drawTiles(this.ctx, this.world.all(), this.theme);
    this.blasts = drawExplosions(this.ctx, this.blasts, performance.now(), this.theme);
  }

  private readonly handlePointer = (e: PointerEvent): void => {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    const tile = this.world.tileAt(e.clientX - rect.left, e.clientY - rect.top, this.radius * 0.25);
    if (tile) this.handlers.onTap(tile);
    else this.handlers.onTapEmpty();
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
