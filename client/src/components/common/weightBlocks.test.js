import { describe, expect, it } from 'vitest';
import { createWeightDenominations, sumWeightBlocks } from './weightBlocks.js';

describe('virtual scale weight blocks', () => {
  it('derives standard denominations from the model interval and capacity', () => {
    expect(createWeightDenominations(1500, 0.5)).toEqual([
      0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000,
    ]);
  });

  it('adds selected block masses without floating-point drift', () => {
    expect(sumWeightBlocks({ 0.1: 3, 0.2: 2, 5: 1 })).toBe(5.7);
  });

  it('returns no blocks for invalid model capacity or interval', () => {
    expect(createWeightDenominations(0, 0.5)).toEqual([]);
    expect(createWeightDenominations(100, 0)).toEqual([]);
  });
});
