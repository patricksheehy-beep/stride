import { describe, it, expect } from 'vitest';
import { GOLDEN_LOCATIONS } from './fixtures.js';
import { detectRegion } from '../../src/data/region-profiles.js';

describe('Golden Test: Region Detection', () => {
  // Individual region detection assertions for each of 22+ golden locations
  for (const loc of GOLDEN_LOCATIONS) {
    it(`detects ${loc.name} as ${loc.expectedRegion}`, () => {
      expect(detectRegion(loc.lat, loc.lng)).toBe(loc.expectedRegion);
    });
  }

  // Continental diversity: at least 4 distinct regions represented
  it('covers at least 4 distinct continents across GOLDEN_LOCATIONS', () => {
    const regions = new Set(GOLDEN_LOCATIONS.map(l => l.expectedRegion));
    expect(regions.size).toBeGreaterThanOrEqual(4);
  });
});
