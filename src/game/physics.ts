import Matter from 'matter-js';
import type { TileKind } from '../core/tiles';

export type { TileKind } from '../core/tiles';

const { Bodies, Body, Composite, Engine, Events } = Matter;

export interface Tile {
  readonly id: number;
  readonly letter: string;
  readonly kind: TileKind;
  readonly body: Matter.Body;
  /** The tile's number in its round (see tileSpec); the same on both players' fields online. */
  readonly seq: number;
  selected: boolean;
  /** Picked by the bot (or, online, by the other player), which is about to try a word with it. */
  bot: boolean;
}

const WALL = 200;
/** A blast (a bomb's or a green pumpkin's) destroys tiles whose centres are within this many tile radii of it. */
export const BLAST_RADII = 2.6;
/** Tiles within this many radii (but outside the blast) are pushed away. */
const PUSH_RADII = 5;
/** Speed, in px per step, given to a pushed tile right at the edge of the blast. */
const PUSH_SPEED = 6;
/** A ghost drifts down this many of its radii per second. */
export const GHOST_RADII_PER_S = 3.5;

/** A bomb or green pumpkin that went off: where, how far its blast reached, and the tiles it destroyed. */
export interface Explosion {
  x: number;
  y: number;
  radius: number;
  destroyed: Tile[];
}

/** Matter.js world: a floor and two side walls, open at the top, holding round letter tiles. */
export class PhysicsWorld {
  readonly engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.00052 } });
  private readonly tiles = new Map<number, Tile>();
  private walls: Matter.Body[] = [];
  private width = 0;
  private height = 0;
  /** Bombs that hit something since the last step. */
  private readonly impacts = new Set<Tile>();

  constructor(width: number, height: number) {
    this.resize(width, height);
    Events.on(this.engine, 'collisionStart', ({ pairs }) => {
      for (const { bodyA, bodyB } of pairs) {
        for (const body of [bodyA, bodyB]) {
          const tile = this.tiles.get(body.id);
          if (tile?.kind === 'bomb') this.impacts.add(tile);
        }
      }
    });
  }

  /** Rebuilds the walls for a new size and keeps tiles inside it. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    Composite.remove(this.engine.world, this.walls);
    const tall = height * 3;
    this.walls = [
      Bodies.rectangle(width / 2, height + WALL / 2, width + WALL * 2, WALL, { isStatic: true }),
      Bodies.rectangle(-WALL / 2, height - tall / 2, WALL, tall, { isStatic: true }),
      Bodies.rectangle(width + WALL / 2, height - tall / 2, WALL, tall, { isStatic: true }),
    ];
    Composite.add(this.engine.world, this.walls);
    for (const tile of this.tiles.values()) {
      const r = tile.body.circleRadius ?? 0;
      const x = Math.min(Math.max(tile.body.position.x, r), width - r);
      // A ghost is not held by the floor: it may be on its way out below it.
      const y =
        tile.kind === 'ghost' ? tile.body.position.y : Math.min(tile.body.position.y, height - r);
      Matter.Body.setPosition(tile.body, { x, y });
    }
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Adds a tile centred at (x, y). A ghost touches nothing: the engine neither moves it nor
   * collides it, and step() carries it down.
   */
  spawn(
    letter: string,
    x: number,
    y: number,
    radius: number,
    kind: TileKind = 'pumpkin',
    seq = -1,
  ): Tile {
    const body =
      kind === 'ghost'
        ? Bodies.circle(x, y, radius, { isStatic: true, collisionFilter: { mask: 0 } })
        : Bodies.circle(x, y, radius, {
            restitution: 0.3,
            friction: 0.05,
            frictionAir: 0.02,
            density: 0.002,
          });
    const tile: Tile = { id: body.id, letter, kind, body, seq, selected: false, bot: false };
    this.tiles.set(tile.id, tile);
    Composite.add(this.engine.world, body);
    return tile;
  }

  remove(tile: Tile): void {
    if (this.tiles.delete(tile.id)) Composite.remove(this.engine.world, tile.body);
  }

  all(): Tile[] {
    return [...this.tiles.values()];
  }

  get count(): number {
    return this.tiles.size;
  }

  /**
   * The tile under a point, or the nearest one within `slop` pixels of its edge,
   * so near-misses on small screens still count. A ghost under the point comes first: it is
   * drawn over the tiles it passes through.
   */
  tileAt(x: number, y: number, slop = 0): Tile | undefined {
    let best: Tile | undefined;
    let bestGap = slop;
    let bestGhost = false;
    for (const tile of this.tiles.values()) {
      const { x: tx, y: ty } = tile.body.position;
      const gap = Math.hypot(tx - x, ty - y) - (tile.body.circleRadius ?? 0);
      const ghost = tile.kind === 'ghost' && gap <= 0;
      if (ghost === bestGhost ? gap <= bestGap : ghost) {
        best = tile;
        bestGap = gap;
        bestGhost = ghost;
      }
    }
    return best;
  }

  /**
   * Advances the world; bombs that hit something explode. Returns those explosions. Ghosts
   * drift down at a steady speed and are gone once they are below the field.
   */
  step(ms: number): Explosion[] {
    for (const tile of this.tiles.values()) {
      if (tile.kind !== 'ghost') continue;
      const r = tile.body.circleRadius ?? 0;
      const { x, y } = tile.body.position;
      if (y - r > this.height) this.remove(tile);
      else Body.setPosition(tile.body, { x, y: y + (r * GHOST_RADII_PER_S * ms) / 1000 });
    }
    Engine.update(this.engine, ms);
    const explosions: Explosion[] = [];
    for (const bomb of this.impacts) {
      if (this.tiles.has(bomb.id)) explosions.push(this.explode(bomb));
    }
    this.impacts.clear();
    return explosions;
  }

  /**
   * Removes the bomb (or green pumpkin) and every tile in its blast, and pushes the tiles just
   * beyond it away. Ghosts are untouched.
   */
  explode(bomb: Tile): Explosion {
    const { x, y } = bomb.body.position;
    const r = bomb.body.circleRadius ?? 0;
    const blast = r * BLAST_RADII;
    this.remove(bomb);
    const destroyed: Tile[] = [];
    for (const tile of this.tiles.values()) {
      if (tile.kind === 'ghost') continue;
      const dx = tile.body.position.x - x;
      const dy = tile.body.position.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance <= blast) {
        destroyed.push(tile);
      } else if (distance <= r * PUSH_RADII) {
        const speed = (PUSH_SPEED * blast) / distance;
        Body.setVelocity(tile.body, {
          x: tile.body.velocity.x + (dx / distance) * speed,
          y: tile.body.velocity.y + (dy / distance) * speed,
        });
      }
    }
    for (const tile of destroyed) this.remove(tile);
    return { x, y, radius: blast, destroyed };
  }
}
