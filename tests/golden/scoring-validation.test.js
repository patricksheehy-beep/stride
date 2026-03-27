import { describe, it, expect } from 'vitest';
import { GOLDEN_LOCATIONS } from './fixtures.js';
import { getWeightsForRegion, REGION_WEIGHTS } from '../../src/scoring/weights.js';
import { analyzeDataQuality } from '../../src/data/data-quality.js';

/**
 * Build a mock GeoJSON FeatureCollection with the specified number of features.
 * Each feature is a LineString with highway and osmType properties.
 *
 * @param {number} count - Number of features to generate
 * @param {string} [highwayType='path'] - Highway type for feature properties
 * @returns {Object} GeoJSON FeatureCollection
 */
function buildMockFeatureCollection(count, highwayType = 'path') {
  const features = [];
  for (let i = 0; i < count; i++) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[0 + i * 0.001, 0], [0.01 + i * 0.001, 0.01]]
      },
      properties: {
        highway: highwayType,
        osmType: 'way'
      }
    });
  }
  return { type: 'FeatureCollection', features };
}

describe('Golden Test: Scoring Validation', () => {
  const requiredKeys = ['surface', 'continuity', 'trailPreference', 'scenic', 'greenSpace'];

  describe('weight profile structure', () => {
    for (const loc of GOLDEN_LOCATIONS) {
      it(`getWeightsForRegion("${loc.expectedRegion}") returns valid object with all 5 keys for ${loc.name}`, () => {
        const weights = getWeightsForRegion(loc.expectedRegion);
        expect(weights).toBeDefined();
        for (const key of requiredKeys) {
          expect(weights).toHaveProperty(key);
          expect(typeof weights[key]).toBe('number');
        }
      });
    }
  });

  describe('weight profile sums', () => {
    for (const regionKey of Object.keys(REGION_WEIGHTS)) {
      it(`${regionKey} weights sum to 1.0 within 0.001 tolerance`, () => {
        const weights = REGION_WEIGHTS[regionKey];
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
      });
    }
  });

  describe('region-specific weight assertions', () => {
    it('Japan surface weight >= 0.25 (reflects reliable surface tagging)', () => {
      const weights = getWeightsForRegion('japan');
      expect(weights.surface).toBeGreaterThanOrEqual(0.25);
    });

    it('Europe trailPreference weight >= 0.30 (reflects excellent trail networks)', () => {
      const weights = getWeightsForRegion('europe');
      expect(weights.trailPreference).toBeGreaterThanOrEqual(0.30);
    });

    it('Africa continuity weight >= 0.30 (reflects sparse data, dead-end avoidance critical)', () => {
      const weights = getWeightsForRegion('africa');
      expect(weights.continuity).toBeGreaterThanOrEqual(0.30);
    });

    it('US continuity weight >= 0.25 (reflects sparse surface tagging)', () => {
      const weights = getWeightsForRegion('us');
      expect(weights.continuity).toBeGreaterThanOrEqual(0.25);
    });
  });

  describe('data quality analysis', () => {
    it('0 features => density sparse', () => {
      const result = analyzeDataQuality(buildMockFeatureCollection(0));
      expect(result.density).toBe('sparse');
    });

    it('3 features => density sparse with non-null message', () => {
      const result = analyzeDataQuality(buildMockFeatureCollection(3));
      expect(result.density).toBe('sparse');
      expect(result.message).not.toBeNull();
    });

    it('15 features => density moderate', () => {
      const result = analyzeDataQuality(buildMockFeatureCollection(15));
      expect(result.density).toBe('moderate');
    });

    it('50 features => density rich with null message', () => {
      const result = analyzeDataQuality(buildMockFeatureCollection(50));
      expect(result.density).toBe('rich');
      expect(result.message).toBeNull();
    });

    it('data_sparse locations: sparse mock returns message containing "limited"', () => {
      const sparseLocations = GOLDEN_LOCATIONS.filter(l => l.category === 'data_sparse');
      expect(sparseLocations.length).toBeGreaterThan(0);
      for (const loc of sparseLocations) {
        const result = analyzeDataQuality(buildMockFeatureCollection(3));
        expect(result.density).toBe('sparse');
        expect(result.message).toMatch(/limited/i);
      }
    });
  });
});
