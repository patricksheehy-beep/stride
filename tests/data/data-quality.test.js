import { describe, it, expect } from 'vitest';
import { analyzeDataQuality } from '../../src/data/data-quality.js';

/**
 * Helper: create a GeoJSON FeatureCollection with N features.
 * Each feature has a highway tag from the provided types (round-robin).
 */
function makeFeatureCollection(count, highwayTypes = ['path'], options = {}) {
  const features = [];
  for (let i = 0; i < count; i++) {
    const highway = highwayTypes[i % highwayTypes.length];
    const props = { highway, ...options.extraProps };
    if (options.relationMembers && options.relationMembers.includes(i)) {
      props.osmType = 'relation_member';
    }
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[0, 0], [0.01, 0.01]]
      },
      properties: props
    });
  }
  return { type: 'FeatureCollection', features };
}

describe('analyzeDataQuality', () => {
  // ── Empty / null input ──────────────────────────────────────────
  it('returns sparse with 0 features for empty FeatureCollection', () => {
    const result = analyzeDataQuality({ type: 'FeatureCollection', features: [] });
    expect(result.totalFeatures).toBe(0);
    expect(result.density).toBe('sparse');
    expect(result.hasRouteRelations).toBe(false);
    expect(result.highwayDistribution).toEqual({});
  });

  it('returns sparse with 0 features for null input', () => {
    const result = analyzeDataQuality(null);
    expect(result.totalFeatures).toBe(0);
    expect(result.density).toBe('sparse');
  });

  it('returns sparse with 0 features for undefined input', () => {
    const result = analyzeDataQuality(undefined);
    expect(result.totalFeatures).toBe(0);
    expect(result.density).toBe('sparse');
  });

  // ── Density classification ──────────────────────────────────────
  it('classifies 3 features as sparse', () => {
    const geojson = makeFeatureCollection(3);
    const result = analyzeDataQuality(geojson);
    expect(result.totalFeatures).toBe(3);
    expect(result.density).toBe('sparse');
  });

  it('classifies 5 features as sparse (boundary)', () => {
    const geojson = makeFeatureCollection(5);
    const result = analyzeDataQuality(geojson);
    expect(result.density).toBe('sparse');
  });

  it('classifies 6 features as moderate (just above sparse threshold)', () => {
    const geojson = makeFeatureCollection(6);
    const result = analyzeDataQuality(geojson);
    expect(result.density).toBe('moderate');
  });

  it('classifies 15 features as moderate', () => {
    const geojson = makeFeatureCollection(15);
    const result = analyzeDataQuality(geojson);
    expect(result.totalFeatures).toBe(15);
    expect(result.density).toBe('moderate');
  });

  it('classifies 25 features as moderate (boundary)', () => {
    const geojson = makeFeatureCollection(25);
    const result = analyzeDataQuality(geojson);
    expect(result.density).toBe('moderate');
  });

  it('classifies 26 features as rich (just above moderate threshold)', () => {
    const geojson = makeFeatureCollection(26);
    const result = analyzeDataQuality(geojson);
    expect(result.density).toBe('rich');
  });

  it('classifies 50 features as rich', () => {
    const geojson = makeFeatureCollection(50);
    const result = analyzeDataQuality(geojson);
    expect(result.totalFeatures).toBe(50);
    expect(result.density).toBe('rich');
  });

  // ── Highway distribution ────────────────────────────────────────
  it('correctly counts highway types in distribution', () => {
    const geojson = makeFeatureCollection(6, ['path', 'footway', 'track']);
    const result = analyzeDataQuality(geojson);
    expect(result.highwayDistribution).toEqual({
      path: 2,
      footway: 2,
      track: 2
    });
  });

  it('counts single highway type correctly', () => {
    const geojson = makeFeatureCollection(4, ['footway']);
    const result = analyzeDataQuality(geojson);
    expect(result.highwayDistribution).toEqual({ footway: 4 });
  });

  // ── Route relation detection ────────────────────────────────────
  it('detects route relations via osmType relation_member', () => {
    const geojson = makeFeatureCollection(5, ['path'], { relationMembers: [2] });
    const result = analyzeDataQuality(geojson);
    expect(result.hasRouteRelations).toBe(true);
  });

  it('returns hasRouteRelations false when no relation members present', () => {
    const geojson = makeFeatureCollection(5, ['path']);
    const result = analyzeDataQuality(geojson);
    expect(result.hasRouteRelations).toBe(false);
  });

  // ── User-facing messages ────────────────────────────────────────
  it('sparse result message contains "limited"', () => {
    const result = analyzeDataQuality(makeFeatureCollection(2));
    expect(result.message).toBeTruthy();
    expect(result.message.toLowerCase()).toContain('limited');
  });

  it('empty result message contains "very limited trail data"', () => {
    const result = analyzeDataQuality({ type: 'FeatureCollection', features: [] });
    expect(result.message.toLowerCase()).toContain('very limited trail data');
  });

  it('moderate result message contains "Moderate"', () => {
    const result = analyzeDataQuality(makeFeatureCollection(15));
    expect(result.message).toBeTruthy();
    expect(result.message).toContain('Moderate');
  });

  it('rich result message is null', () => {
    const result = analyzeDataQuality(makeFeatureCollection(50));
    expect(result.message).toBeNull();
  });
});
