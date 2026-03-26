import { describe, it, expect } from 'vitest';
import { scoreContinuity } from '../../src/scoring/factors/continuity.js';
import { featureCollection, lineString } from '@turf/helpers';

describe('scoreContinuity', () => {
  it('returns score near 1.0 for a straight-line route', () => {
    // Straight east-west line -- no turns
    const route = featureCollection([
      lineString([
        [-122.05, 37.38],
        [-122.04, 37.38],
        [-122.03, 37.38],
        [-122.02, 37.38],
        [-122.01, 37.38]
      ])
    ]);
    const score = scoreContinuity(route);
    expect(score).toBeGreaterThanOrEqual(0.9);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('returns lower score for route with many sharp turns (>120 degree)', () => {
    // U-turn pattern: east then west repeatedly, creating ~180-degree bearing changes
    const route = featureCollection([
      lineString([
        [-122.05, 37.38],
        [-122.04, 37.38],      // east
        [-122.045, 37.3801],   // west (u-turn)
        [-122.035, 37.3801],   // east (u-turn)
        [-122.04, 37.3802],    // west (u-turn)
        [-122.03, 37.3802],    // east (u-turn)
        [-122.035, 37.3803],   // west (u-turn)
        [-122.025, 37.3803]    // east (u-turn)
      ])
    ]);
    const score = scoreContinuity(route);
    // Should be noticeably lower than 1.0 due to sharp turns
    expect(score).toBeLessThan(0.8);
  });

  it('returns 1.0 for single-point route (no penalty)', () => {
    // Only 2 coordinates -- no triplet to evaluate
    const route = featureCollection([
      lineString([
        [-122.05, 37.38],
        [-122.04, 37.38]
      ])
    ]);
    const score = scoreContinuity(route);
    expect(score).toBe(1.0);
  });

  it('returns 1.0 for route with only 1 point (edge case)', () => {
    // FeatureCollection with a single-coordinate LineString is invalid GeoJSON
    // but we handle gracefully. Use 2 coords (minimum valid LineString).
    const route = featureCollection([
      lineString([
        [-122.05, 37.38],
        [-122.04, 37.38]
      ])
    ]);
    const score = scoreContinuity(route);
    expect(score).toBe(1.0);
  });

  it('score is always between 0 and 1', () => {
    // Even extreme zig-zag should clamp
    const coords = [];
    for (let i = 0; i < 20; i++) {
      coords.push([
        -122.05 + (i % 2 === 0 ? 0 : 0.01),
        37.38 + i * 0.005
      ]);
    }
    const route = featureCollection([lineString(coords)]);
    const score = scoreContinuity(route);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('handles empty FeatureCollection gracefully', () => {
    const route = featureCollection([]);
    const score = scoreContinuity(route);
    expect(score).toBe(1.0);
  });
});
