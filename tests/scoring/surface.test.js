import { describe, it, expect } from 'vitest';
import { scoreSurface, SURFACE_SCORES } from '../../src/scoring/factors/surface.js';
import { featureCollection, lineString } from '@turf/helpers';

/**
 * Helper: build a FeatureCollection with one LineString feature
 * having the given surface property.
 */
function makeTrailData(features) {
  return featureCollection(
    features.map(({ coords, surface, highway }) => {
      const props = {};
      if (surface !== undefined) props.surface = surface;
      if (highway !== undefined) props.highway = highway;
      return lineString(coords, props);
    })
  );
}

// ~500m segment in Sunnyvale, CA
const shortSegment = [[-122.03, 37.38], [-122.025, 37.38]];
// ~1km segment
const longSegment = [[-122.03, 37.38], [-122.02, 37.38]];

describe('SURFACE_SCORES lookup table', () => {
  it('contains all 16+ surface values from research', () => {
    const expectedSurfaces = [
      'tartan', 'fine_gravel', 'compacted', 'asphalt', 'concrete',
      'paving_stones', 'gravel', 'ground', 'dirt', 'earth', 'grass',
      'woodchips', 'sand', 'mud', 'snow', 'ice', 'unknown'
    ];
    for (const s of expectedSurfaces) {
      expect(SURFACE_SCORES).toHaveProperty(s);
    }
    expect(Object.keys(SURFACE_SCORES).length).toBeGreaterThanOrEqual(17);
  });

  it('has fine_gravel at 0.95', () => {
    expect(SURFACE_SCORES.fine_gravel).toBe(0.95);
  });

  it('has tartan at 1.0', () => {
    expect(SURFACE_SCORES.tartan).toBe(1.0);
  });

  it('has unknown at 0.5', () => {
    expect(SURFACE_SCORES.unknown).toBe(0.5);
  });
});

describe('scoreSurface', () => {
  it('returns score near 0.95 for fine_gravel features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, surface: 'fine_gravel' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(0.95, 1);
  });

  it('returns score near 0.85 for asphalt features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, surface: 'asphalt' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(0.85, 1);
  });

  it('returns score near 0.15 for mud features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, surface: 'mud' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(0.15, 1);
  });

  it('returns 0.5 for features missing surface tag (neutral, NOT 0)', () => {
    const trailData = makeTrailData([
      { coords: shortSegment }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBe(0.5);
  });

  it('returns length-weighted average for mixed surfaces', () => {
    // long segment = fine_gravel (0.95), short segment = mud (0.15)
    // long is ~2x the length of short, so weighted avg should be closer to 0.95
    const trailData = makeTrailData([
      { coords: longSegment, surface: 'fine_gravel' },
      { coords: shortSegment, surface: 'mud' }
    ]);
    const routeGeoJSON = featureCollection([lineString(longSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);

    // Should be between 0.15 and 0.95, biased toward 0.95
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(0.95);
  });

  it('returns 0.5 when trail data has no features', () => {
    const trailData = featureCollection([]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBe(0.5);
  });

  it('returns a number between 0 and 1', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, surface: 'fine_gravel' },
      { coords: longSegment, surface: 'mud' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreSurface(routeGeoJSON, trailData);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
