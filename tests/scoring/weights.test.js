import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS, REGION_WEIGHTS, getWeightsForRegion, mergeWeights } from '../../src/scoring/weights.js';

describe('DEFAULT_WEIGHTS', () => {
  it('has 5 keys: surface, continuity, trailPreference, scenic, greenSpace', () => {
    expect(DEFAULT_WEIGHTS).toHaveProperty('surface');
    expect(DEFAULT_WEIGHTS).toHaveProperty('continuity');
    expect(DEFAULT_WEIGHTS).toHaveProperty('trailPreference');
    expect(DEFAULT_WEIGHTS).toHaveProperty('scenic');
    expect(DEFAULT_WEIGHTS).toHaveProperty('greenSpace');
    expect(Object.keys(DEFAULT_WEIGHTS)).toHaveLength(5);
  });

  it('values sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('trailPreference has the highest weight', () => {
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.surface);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.continuity);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.scenic);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.greenSpace);
  });
});

describe('getWeightsForRegion', () => {
  it('returns DEFAULT_WEIGHTS for "default" region', () => {
    const weights = getWeightsForRegion('default');
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('returns weights for "japan" where surface is boosted', () => {
    const weights = getWeightsForRegion('japan');
    expect(weights.surface).toBeGreaterThanOrEqual(0.25);
  });

  it('returns weights for all regions with greenSpace property', () => {
    const regions = ['default', 'japan', 'europe', 'us'];
    for (const region of regions) {
      const weights = getWeightsForRegion(region);
      expect(weights).toHaveProperty('greenSpace');
      expect(typeof weights.greenSpace).toBe('number');
      expect(weights.greenSpace).toBeGreaterThan(0);
    }
  });

  it('returns weights for "europe" where trailPreference is boosted', () => {
    const weights = getWeightsForRegion('europe');
    expect(weights.trailPreference).toBeGreaterThan(DEFAULT_WEIGHTS.trailPreference);
  });

  it('returns weights for "us" where continuity is boosted', () => {
    const weights = getWeightsForRegion('us');
    expect(weights.continuity).toBeGreaterThan(DEFAULT_WEIGHTS.continuity);
  });

  it('falls back to DEFAULT_WEIGHTS for unknown region', () => {
    const weights = getWeightsForRegion('unknown_region');
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('all region weight profiles sum to 1.0', () => {
    const regions = ['default', 'japan', 'europe', 'us'];
    for (const region of regions) {
      const weights = getWeightsForRegion(region);
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});

describe('REGION_WEIGHTS', () => {
  it('has profiles for default, japan, europe, us', () => {
    expect(REGION_WEIGHTS).toHaveProperty('default');
    expect(REGION_WEIGHTS).toHaveProperty('japan');
    expect(REGION_WEIGHTS).toHaveProperty('europe');
    expect(REGION_WEIGHTS).toHaveProperty('us');
  });

  it('each profile has the same 5 keys as DEFAULT_WEIGHTS', () => {
    for (const profile of Object.values(REGION_WEIGHTS)) {
      expect(Object.keys(profile).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
    }
  });

  it('all REGION_WEIGHTS profiles have greenSpace key', () => {
    for (const [name, profile] of Object.entries(REGION_WEIGHTS)) {
      expect(profile).toHaveProperty('greenSpace');
    }
  });
});

describe('mergeWeights', () => {
  it('mergeWeights(regionDefaults, nlWeights) returns object with all 5 keys', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    const nl = { scenic: 0.5, greenSpace: 0.5 };
    const result = mergeWeights(region, nl);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result).toHaveProperty('surface');
    expect(result).toHaveProperty('continuity');
    expect(result).toHaveProperty('trailPreference');
    expect(result).toHaveProperty('scenic');
    expect(result).toHaveProperty('greenSpace');
  });

  it('NL weights override region defaults for specified keys', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    const nl = { scenic: 0.8 };
    const result = mergeWeights(region, nl);
    // After merge and normalize, scenic should be the highest
    const maxKey = Object.entries(result).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    expect(maxKey).toBe('scenic');
  });

  it('result is normalized to sum to 1.0', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    const nl = { scenic: 0.9, greenSpace: 0.9 };
    const result = mergeWeights(region, nl);
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('if NL weights are empty object, region defaults returned unchanged', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    const result = mergeWeights(region, {});
    expect(result).toEqual(region);
  });

  it('if NL weights are null/undefined, region defaults returned unchanged', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    expect(mergeWeights(region, null)).toEqual(region);
    expect(mergeWeights(region, undefined)).toEqual(region);
  });

  it('partial NL overrides (only 2 of 5 keys) merge correctly with remaining region values', () => {
    const region = { surface: 0.20, continuity: 0.20, trailPreference: 0.25, scenic: 0.15, greenSpace: 0.20 };
    const nl = { surface: 0.6, greenSpace: 0.6 };
    const result = mergeWeights(region, nl);
    // All 5 keys present
    expect(Object.keys(result)).toHaveLength(5);
    // Sum to 1.0
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    // surface and greenSpace should be equal and higher than before
    expect(result.surface).toBeCloseTo(result.greenSpace, 5);
    expect(result.surface).toBeGreaterThan(result.continuity);
  });
});
