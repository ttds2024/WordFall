import { describe, expect, it } from 'vitest';
import { maxTilesFor, Spawner, tileRadius } from './spawner';

describe('Spawner', () => {
  it('spawns once per interval', () => {
    const spawner = new Spawner(1000, 50);
    expect(spawner.update(600, 0)).toBe(0);
    expect(spawner.update(600, 0)).toBe(1);
    expect(spawner.update(2000, 0)).toBe(2);
  });

  it('spawns groups of a random size, waiting one interval per tile of the last group', () => {
    const rolls = [0.9, 0.1, 0.6];
    const spawner = new Spawner(1000, 50, 2, () => rolls.shift() ?? 0);
    expect(spawner.update(900, 0)).toBe(0);
    expect(spawner.update(100, 0)).toBe(2);
    expect(spawner.update(1900, 2)).toBe(0);
    expect(spawner.update(100, 2)).toBe(1);
    expect(spawner.update(1000, 3)).toBe(2);
  });

  it('cuts a group short at the tile limit', () => {
    const spawner = new Spawner(1000, 5, 2, () => 0.9);
    expect(spawner.update(1000, 4)).toBe(1);
    expect(spawner.update(1000, 5)).toBe(0);
    expect(spawner.update(1000, 3)).toBe(2);
  });

  it('stops at the tile limit', () => {
    const spawner = new Spawner(1000, 3);
    expect(spawner.update(1000, 3)).toBe(0);
    expect(spawner.update(3000, 1)).toBe(2);
  });
});

describe('sizing', () => {
  it('keeps the radius between 22 and 40 px', () => {
    expect(tileRadius(200)).toBe(22);
    expect(tileRadius(420)).toBe(30);
    expect(tileRadius(1600)).toBe(40);
  });

  it('allows at least 8 tiles', () => {
    expect(maxTilesFor(100, 100, 40)).toBe(8);
    expect(maxTilesFor(420, 800, 30)).toBe(62);
  });
});
