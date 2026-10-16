import { describe, expect, it } from 'vitest';
import { BLAST_RADII, PhysicsWorld, type Explosion } from './physics';

const STEP = 1000 / 60;

function run(world: PhysicsWorld, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) world.step(STEP);
}

describe('PhysicsWorld', () => {
  it('drops a tile onto the floor', () => {
    const world = new PhysicsWorld(400, 600);
    const tile = world.spawn('A', 200, -30, 30);
    run(world, 4);
    expect(tile.body.position.y).toBeGreaterThan(560);
    expect(tile.body.position.y).toBeLessThanOrEqual(571);
  });

  it('piles tiles up instead of overlapping', () => {
    const world = new PhysicsWorld(100, 600);
    const tiles = [0, 1, 2].map((i) => world.spawn('A', 50, -30 - i * 70, 30));
    run(world, 6);
    const ys = tiles.map((t) => t.body.position.y).sort((a, b) => a - b);
    expect(ys[1]! - ys[0]!).toBeGreaterThan(40);
    expect(ys[2]! - ys[1]!).toBeGreaterThan(40);
  });

  it('keeps tiles between the walls', () => {
    const world = new PhysicsWorld(300, 600);
    const tiles = Array.from({ length: 20 }, (_, i) => world.spawn('A', 20 + i * 13, -40 * i, 20));
    run(world, 8);
    for (const tile of tiles) {
      expect(tile.body.position.x).toBeGreaterThan(0);
      expect(tile.body.position.x).toBeLessThan(300);
    }
  });

  it('finds the tile under a point, with slop', () => {
    const world = new PhysicsWorld(400, 600);
    const tile = world.spawn('Q', 100, 100, 30);
    expect(world.tileAt(110, 110)).toBe(tile);
    expect(world.tileAt(100, 135)).toBeUndefined();
    expect(world.tileAt(100, 135, 8)).toBe(tile);
  });

  it('removes tiles', () => {
    const world = new PhysicsWorld(400, 600);
    const tile = world.spawn('A', 100, 100, 30);
    world.remove(tile);
    expect(world.count).toBe(0);
    expect(world.tileAt(100, 100)).toBeUndefined();
  });

  it('moves tiles back inside after shrinking', () => {
    const world = new PhysicsWorld(400, 600);
    const tile = world.spawn('A', 380, 100, 20);
    world.resize(200, 600);
    expect(tile.body.position.x).toBeLessThanOrEqual(180);
  });
});

describe('tile kinds', () => {
  it('spawns pumpkins by default and skulls on request', () => {
    const world = new PhysicsWorld(400, 600);
    expect(world.spawn('A', 100, 100, 30).kind).toBe('pumpkin');
    expect(world.spawn('', 200, 100, 30, 'skull').kind).toBe('skull');
  });
});

describe('skulls', () => {
  /** Steps until something explodes, for up to `seconds`. */
  function runUntilBoom(world: PhysicsWorld, seconds: number): Explosion[] {
    for (let i = 0; i < seconds * 60; i++) {
      const explosions = world.step(STEP);
      if (explosions.length > 0) return explosions;
    }
    return [];
  }

  it('explode on hitting the floor', () => {
    const world = new PhysicsWorld(400, 600);
    const skull = world.spawn('', 200, -30, 30, 'skull');
    const [boom] = runUntilBoom(world, 4);
    expect(boom).toBeDefined();
    expect(boom!.y).toBeGreaterThan(500);
    expect(boom!.radius).toBe(30 * BLAST_RADII);
    expect(world.all()).not.toContain(skull);
  });

  it('destroy nearby tiles and push farther ones away', () => {
    const world = new PhysicsWorld(800, 600);
    const near = world.spawn('A', 340, 570, 30);
    const alsoNear = world.spawn('B', 460, 570, 30);
    const far = world.spawn('C', 530, 570, 30);
    const away = world.spawn('D', 50, 570, 30);
    run(world, 1);
    world.spawn('', 400, 400, 30, 'skull');
    const [boom] = runUntilBoom(world, 3);
    expect(boom!.destroyed).toEqual(expect.arrayContaining([near, alsoNear]));
    expect(boom!.destroyed).toHaveLength(2);
    expect(world.all()).toEqual(expect.arrayContaining([far, away]));
    expect(far.body.velocity.x).toBeGreaterThan(0);
    expect(world.count).toBe(2);
  });

  it('explode when landing on a tile', () => {
    const world = new PhysicsWorld(100, 600);
    const below = world.spawn('A', 50, 570, 30);
    run(world, 1);
    world.spawn('', 50, 300, 30, 'skull');
    const [boom] = runUntilBoom(world, 3);
    expect(boom!.destroyed).toEqual([below]);
    expect(world.count).toBe(0);
  });
});
