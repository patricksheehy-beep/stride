import { describe, it, expect } from 'vitest';
import { scoreTrailPreference, HIGHWAY_PREFERENCE } from '../../src/scoring/factors/trail-preference.js';
import { featureCollection, lineString } from '@turf/helpers';

function makeTrailData(features) {
  return featureCollection(
    features.map(({ coords, highway, surface }) => {
      const props = {};
      if (highway !== undefined) props.highway = highway;
      if (surface !== undefined) props.surface = surface;
      return lineString(coords, props);
    })
  );
}

const shortSegment = [[-122.03, 37.38], [-122.025, 37.38]];
const longSegment = [[-122.03, 37.38], [-122.02, 37.38]];

describe('HIGHWAY_PREFERENCE lookup table', () => {
  it('contains all 12 highway types from research', () => {
    const expectedTypes = [
      'path', 'footway', 'track', 'bridleway', 'cycleway', 'pedestrian',
      'steps', 'living_street', 'residential', 'unclassified', 'service', 'tertiary'
    ];
    for (const h of expectedTypes) {
      expect(HIGHWAY_PREFERENCE).toHaveProperty(h);
    }
    expect(Object.keys(HIGHWAY_PREFERENCE).length).toBeGreaterThanOrEqual(12);
  });

  it('has path at 1.0 (highest preference)', () => {
    expect(HIGHWAY_PREFERENCE.path).toBe(1.0);
  });

  it('has residential at 0.20', () => {
    expect(HIGHWAY_PREFERENCE.residential).toBe(0.20);
  });
});

describe('scoreTrailPreference', () => {
  it('returns 1.0 for highway=path features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, highway: 'path' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('returns 0.90 for highway=footway features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, highway: 'footway' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(0.90, 1);
  });

  it('returns 0.20 for highway=residential features', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, highway: 'residential' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBeCloseTo(0.20, 1);
  });

  it('returns length-weighted average for mixed highway types', () => {
    // long segment = path (1.0), short segment = residential (0.20)
    const trailData = makeTrailData([
      { coords: longSegment, highway: 'path' },
      { coords: shortSegment, highway: 'residential' }
    ]);
    const routeGeoJSON = featureCollection([lineString(longSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);

    // Should be between 0.20 and 1.0, biased toward 1.0
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1.0);
  });

  it('returns 0.3 for features missing highway tag (neutral-low)', () => {
    const trailData = makeTrailData([
      { coords: shortSegment }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBe(0.3);
  });

  it('returns 0.3 when trail data has no features', () => {
    const trailData = featureCollection([]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBe(0.3);
  });

  it('returns a number between 0 and 1', () => {
    const trailData = makeTrailData([
      { coords: shortSegment, highway: 'path' },
      { coords: longSegment, highway: 'tertiary' }
    ]);
    const routeGeoJSON = featureCollection([lineString(shortSegment)]);
    const score = scoreTrailPreference(routeGeoJSON, trailData);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
