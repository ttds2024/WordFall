import { describe, expect, it } from 'vitest';
import { maxTilesFor, Spawner, tileRadius } from './spawner';

describe('Spawner', () => {
  it('spawns once per interval', () => {
    const spawner = new Spawner(1000, 50);
    expect(spawner.update(600, 0)).toBe(0);
    expect(spawner.update(600, 0)).toBe(1);
    expect(spawner.update(2000, 0)).toBe(2);
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
