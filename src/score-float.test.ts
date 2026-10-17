import { describe, expect, it } from 'vitest';
import { floatPosition } from './score-float';

describe('floatPosition', () => {
  it('starts at the middle of the tiles', () => {
    expect(
      floatPosition(
        [
          { x: 100, y: 400 },
          { x: 200, y: 500 },
        ],
        400,
        700,
      ),
    ).toEqual({ x: 150, y: 450 });
  });

  it('stays inside the field with room to rise', () => {
    expect(floatPosition([{ x: 5, y: 10 }], 400, 700)).toEqual({ x: 70, y: 90 });
    expect(floatPosition([{ x: 399, y: 699 }], 400, 700)).toEqual({ x: 330, y: 670 });
  });
});
