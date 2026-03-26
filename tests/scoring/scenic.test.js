import { describe, it, expect } from 'vitest';
import { scoreScenic } from '../../src/scoring/factors/scenic.js';
import { featureCollection, lineString } from '@turf/helpers';

const baseCoords = [[-122.03, 37.38], [-122.025, 37.38]];

function makeTrailData(features) {
  return featureCollection(
    features.map(({ coords, ...props }) => lineString(coords || baseCoords, props))
  );
}

describe('scoreScenic', () => {
  it('returns higher score for features with natural=water nearby', () => {
    const trailData = makeTrailData([
      { natural: 'water' },
      { natural: 'water' },
      { natural: 'water' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    // 3 water features should give maximum water sub-signal (0.4)
    // plus base scenic from other signals
    expect(score).toBeGreaterThan(0.3);
  });

  it('returns higher score for features with leisure=park nearby', () => {
    const trailData = makeTrailData([
      { leisure: 'park' },
      { leisure: 'park' },
      { leisure: 'park' },
      { leisure: 'park' },
      { leisure: 'park' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    // 5 park features should give maximum green sub-signal (0.3)
    expect(score).toBeGreaterThan(0.3);
  });

  it('returns higher score for features with routeType (hiking relation membership)', () => {
    const trailData = makeTrailData([
      { routeType: 'hiking' },
      { routeType: 'hiking' },
      { routeType: 'hiking' },
      { routeType: 'hiking' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    // 4 named trail features should give maximum trail bonus (0.3)
    expect(score).toBeGreaterThan(0.3);
  });

  it('returns base score of 0.3 when no scenic indicators found', () => {
    const trailData = makeTrailData([
      { highway: 'residential' },
      { highway: 'service' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBe(0.3);
  });

  it('returns 0.3 when trail data has no features', () => {
    const trailData = featureCollection([]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBe(0.3);
  });

  it('score is always between 0 and 1', () => {
    const trailData = makeTrailData([
      { natural: 'water' },
      { waterway: 'stream' },
      { natural: 'water' },
      { leisure: 'park' },
      { leisure: 'nature_reserve' },
      { landuse: 'forest' },
      { natural: 'wood' },
      { natural: 'grassland' },
      { routeType: 'hiking' },
      { routeType: 'foot' },
      { routeType: 'hiking' },
      { routeType: 'hiking' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('detects waterway=stream and waterway=river as water features', () => {
    const trailData = makeTrailData([
      { waterway: 'stream' },
      { waterway: 'river' },
      { waterway: 'canal' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBeGreaterThan(0.3);
  });

  it('detects water-related names in feature name', () => {
    const trailData = makeTrailData([
      { name: 'Stevens Creek Trail' },
      { name: 'Lake Elizabeth Path' },
      { name: 'Pond Loop Trail' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBeGreaterThan(0.3);
  });

  it('detects green features: landuse=forest, natural=wood, natural=grassland', () => {
    const trailData = makeTrailData([
      { landuse: 'forest' },
      { natural: 'wood' },
      { landuse: 'meadow' },
      { natural: 'grassland' },
      { landuse: 'grass' }
    ]);
    const routeGeoJSON = featureCollection([lineString(baseCoords)]);
    const score = scoreScenic(routeGeoJSON, trailData);
    expect(score).toBeGreaterThan(0.3);
  });
});
