import { describe, it, expect } from 'vitest';
import { scoreGreenSpace } from '../../src/scoring/factors/green-space.js';
import { featureCollection, lineString, polygon } from '@turf/helpers';

// A square park polygon roughly 200m x 200m near Zurich
const parkPolygon = polygon([[
  [8.540, 47.370],
  [8.542, 47.370],
  [8.542, 47.372],
  [8.540, 47.372],
  [8.540, 47.370]
]], { leisure: 'park', name: 'Test Park' });

// A route that passes entirely through the park
const routeInsidePark = featureCollection([
  lineString([
    [8.5405, 47.371],
    [8.5410, 47.371],
    [8.5415, 47.371]
  ])
]);

// A route that passes entirely outside the park (far away)
const routeOutsidePark = featureCollection([
  lineString([
    [8.550, 47.380],
    [8.551, 47.380],
    [8.552, 47.380],
    [8.553, 47.380]
  ])
]);

// A longer route that starts outside, passes through the park, and exits
// roughly half inside, half outside
const routePartiallyThrough = featureCollection([
  lineString([
    [8.538, 47.371],   // outside, west of park
    [8.539, 47.371],   // still outside
    [8.540, 47.371],   // at park edge
    [8.5405, 47.371],  // inside park
    [8.541, 47.371],   // inside park
    [8.5415, 47.371],  // inside park
    [8.542, 47.371],   // at park edge
    [8.543, 47.371],   // outside, east of park
    [8.544, 47.371]    // outside
  ])
]);

// Zero-length route (single point repeated)
const zeroLengthRoute = featureCollection([
  lineString([
    [8.541, 47.371],
    [8.541, 47.371]
  ])
]);

describe('scoreGreenSpace', () => {
  it('returns neutral score 0.4 when landUseFeatures is empty FeatureCollection', () => {
    const emptyLandUse = featureCollection([]);
    const score = scoreGreenSpace(routeInsidePark, emptyLandUse);
    expect(score).toBe(0.4);
  });

  it('returns neutral score 0.4 when landUseFeatures is null', () => {
    const score = scoreGreenSpace(routeInsidePark, null);
    expect(score).toBe(0.4);
  });

  it('returns neutral score 0.4 when landUseFeatures is undefined', () => {
    const score = scoreGreenSpace(routeInsidePark, undefined);
    expect(score).toBe(0.4);
  });

  it('returns score near 1.0 (>= 0.9) for route entirely inside a park', () => {
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(routeInsidePark, landUse);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('returns low score (<= 0.3) for route entirely outside all polygons', () => {
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(routeOutsidePark, landUse);
    expect(score).toBeLessThanOrEqual(0.3);
  });

  it('returns mid score (0.5-0.7) for route partially through a park', () => {
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(routePartiallyThrough, landUse);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThanOrEqual(0.7);
  });

  it('returns neutral score 0.4 for zero-length route', () => {
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(zeroLengthRoute, landUse);
    expect(score).toBe(0.4);
  });

  it('ignores LineString features in landUseFeatures (only uses Polygon/MultiPolygon)', () => {
    const mixedLandUse = featureCollection([
      parkPolygon,
      lineString([[8.540, 47.370], [8.542, 47.370]], { waterway: 'stream' })
    ]);
    const landUsePolygonsOnly = featureCollection([parkPolygon]);

    const scoreMixed = scoreGreenSpace(routeInsidePark, mixedLandUse);
    const scorePolygonsOnly = scoreGreenSpace(routeInsidePark, landUsePolygonsOnly);

    // Should produce the same score since LineString is ignored
    expect(scoreMixed).toBe(scorePolygonsOnly);
  });

  it('returns a score between 0 and 1', () => {
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(routePartiallyThrough, landUse);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns neutral score 0.4 when route has no features', () => {
    const emptyRoute = featureCollection([]);
    const landUse = featureCollection([parkPolygon]);
    const score = scoreGreenSpace(emptyRoute, landUse);
    expect(score).toBe(0.4);
  });
});
