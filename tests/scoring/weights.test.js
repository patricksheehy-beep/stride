import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS, REGION_WEIGHTS, getWeightsForRegion } from '../../src/scoring/weights.js';

describe('DEFAULT_WEIGHTS', () => {
  it('has 4 keys: surface, continuity, trailPreference, scenic', () => {
    expect(DEFAULT_WEIGHTS).toHaveProperty('surface');
    expect(DEFAULT_WEIGHTS).toHaveProperty('continuity');
    expect(DEFAULT_WEIGHTS).toHaveProperty('trailPreference');
    expect(DEFAULT_WEIGHTS).toHaveProperty('scenic');
    expect(Object.keys(DEFAULT_WEIGHTS)).toHaveLength(4);
  });

  it('values sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('trailPreference has the highest weight (0.30)', () => {
    expect(DEFAULT_WEIGHTS.trailPreference).toBe(0.30);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.surface);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.continuity);
    expect(DEFAULT_WEIGHTS.trailPreference).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.scenic);
  });
});

describe('getWeightsForRegion', () => {
  it('returns DEFAULT_WEIGHTS for "default" region', () => {
    const weights = getWeightsForRegion('default');
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('returns weights for "japan" where surface is higher than default', () => {
    const weights = getWeightsForRegion('japan');
    expect(weights.surface).toBeGreaterThan(DEFAULT_WEIGHTS.surface);
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

  it('each profile has the same 4 keys as DEFAULT_WEIGHTS', () => {
    for (const profile of Object.values(REGION_WEIGHTS)) {
      expect(Object.keys(profile).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
    }
  });
});
