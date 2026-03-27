import { describe, it, expect } from 'vitest';
import { regionProfiles, detectRegion } from '../../src/data/region-profiles.js';
import { REGION_WEIGHTS, getWeightsForRegion } from '../../src/scoring/weights.js';
import { GOLDEN_LOCATIONS } from '../golden/fixtures.js';

describe('regionProfiles', () => {
  it('has default, japan, europe, and us profile keys', () => {
    expect(regionProfiles).toHaveProperty('default');
    expect(regionProfiles).toHaveProperty('japan');
    expect(regionProfiles).toHaveProperty('europe');
    expect(regionProfiles).toHaveProperty('us');
  });

  describe('default profile', () => {
    it('has preferredSurfaces array containing compacted, fine_gravel, and dirt', () => {
      expect(regionProfiles.default.preferredSurfaces).toContain('compacted');
      expect(regionProfiles.default.preferredSurfaces).toContain('fine_gravel');
      expect(regionProfiles.default.preferredSurfaces).toContain('dirt');
    });

    it('has avoidSurfaces array', () => {
      expect(regionProfiles.default.avoidSurfaces).toContain('mud');
      expect(regionProfiles.default.avoidSurfaces).toContain('sand');
    });

    it('has maxSacScale set to demanding_mountain_hiking', () => {
      expect(regionProfiles.default.maxSacScale).toBe('demanding_mountain_hiking');
    });

    it('has networkPriority array with iwn, nwn, rwn, lwn', () => {
      expect(regionProfiles.default.networkPriority).toEqual(['iwn', 'nwn', 'rwn', 'lwn']);
    });
  });

  describe('japan profile', () => {
    it('has preferredHighways array containing path', () => {
      expect(regionProfiles.japan.preferredHighways).toContain('path');
    });

    it('has surfaceTaggingReliable set to true', () => {
      expect(regionProfiles.japan.surfaceTaggingReliable).toBe(true);
    });

    it('has nameFields with name:en, name:ja, and name', () => {
      expect(regionProfiles.japan.nameFields).toEqual(['name:en', 'name:ja', 'name']);
    });
  });

  describe('europe profile', () => {
    it('has preferRelations set to true', () => {
      expect(regionProfiles.europe.preferRelations).toBe(true);
    });

    it('has useSacScale set to true', () => {
      expect(regionProfiles.europe.useSacScale).toBe(true);
    });

    it('has useTrailMarking set to true', () => {
      expect(regionProfiles.europe.useTrailMarking).toBe(true);
    });
  });

  describe('us profile', () => {
    it('has useSacScale set to false', () => {
      expect(regionProfiles.us.useSacScale).toBe(false);
    });

    it('has preferredHighways including path, footway, track, cycleway', () => {
      expect(regionProfiles.us.preferredHighways).toContain('path');
      expect(regionProfiles.us.preferredHighways).toContain('footway');
      expect(regionProfiles.us.preferredHighways).toContain('track');
      expect(regionProfiles.us.preferredHighways).toContain('cycleway');
    });

    it('has checkOperator set to true', () => {
      expect(regionProfiles.us.checkOperator).toBe(true);
    });
  });

  // ── New region profiles ─────────────────────────────────────────
  describe('south_america profile', () => {
    it('exists in regionProfiles', () => {
      expect(regionProfiles).toHaveProperty('south_america');
    });

    it('has preferredHighways including footway, path, track, cycleway', () => {
      expect(regionProfiles.south_america.preferredHighways).toContain('footway');
      expect(regionProfiles.south_america.preferredHighways).toContain('path');
      expect(regionProfiles.south_america.preferredHighways).toContain('track');
      expect(regionProfiles.south_america.preferredHighways).toContain('cycleway');
    });

    it('has useSacScale set to false', () => {
      expect(regionProfiles.south_america.useSacScale).toBe(false);
    });

    it('has checkOperator set to false', () => {
      expect(regionProfiles.south_america.checkOperator).toBe(false);
    });
  });

  describe('africa profile', () => {
    it('exists in regionProfiles', () => {
      expect(regionProfiles).toHaveProperty('africa');
    });

    it('has preferredHighways including track, path, footway', () => {
      expect(regionProfiles.africa.preferredHighways).toContain('track');
      expect(regionProfiles.africa.preferredHighways).toContain('path');
      expect(regionProfiles.africa.preferredHighways).toContain('footway');
    });

    it('has surfaceTaggingReliable set to false', () => {
      expect(regionProfiles.africa.surfaceTaggingReliable).toBe(false);
    });

    it('has sparseDataLikely set to true', () => {
      expect(regionProfiles.africa.sparseDataLikely).toBe(true);
    });
  });

  describe('oceania profile', () => {
    it('exists in regionProfiles', () => {
      expect(regionProfiles).toHaveProperty('oceania');
    });

    it('has preferredHighways including footway, path, cycleway, track', () => {
      expect(regionProfiles.oceania.preferredHighways).toContain('footway');
      expect(regionProfiles.oceania.preferredHighways).toContain('path');
      expect(regionProfiles.oceania.preferredHighways).toContain('cycleway');
      expect(regionProfiles.oceania.preferredHighways).toContain('track');
    });

    it('has useSacScale set to false', () => {
      expect(regionProfiles.oceania.useSacScale).toBe(false);
    });
  });

  describe('southeast_asia profile', () => {
    it('exists in regionProfiles', () => {
      expect(regionProfiles).toHaveProperty('southeast_asia');
    });

    it('has preferredHighways including footway, path, pedestrian', () => {
      expect(regionProfiles.southeast_asia.preferredHighways).toContain('footway');
      expect(regionProfiles.southeast_asia.preferredHighways).toContain('path');
      expect(regionProfiles.southeast_asia.preferredHighways).toContain('pedestrian');
    });

    it('has surfaceTaggingReliable set to false', () => {
      expect(regionProfiles.southeast_asia.surfaceTaggingReliable).toBe(false);
    });
  });
});

describe('detectRegion', () => {
  // ── Existing region detection (must not break) ──────────────────
  it('returns japan for Tokyo coordinates (35.6, 139.7)', () => {
    expect(detectRegion(35.6, 139.7)).toBe('japan');
  });

  it('returns europe for Paris coordinates (48.8, 2.3)', () => {
    expect(detectRegion(48.8, 2.3)).toBe('europe');
  });

  it('returns us for New York coordinates (40.7, -74.0)', () => {
    expect(detectRegion(40.7, -74.0)).toBe('us');
  });

  it('returns japan for Hokkaido coordinates (43.0, 141.3)', () => {
    expect(detectRegion(43.0, 141.3)).toBe('japan');
  });

  it('returns europe for Berlin coordinates (52.5, 13.4)', () => {
    expect(detectRegion(52.5, 13.4)).toBe('europe');
  });

  it('returns us for San Francisco coordinates (37.7, -122.4)', () => {
    expect(detectRegion(37.7, -122.4)).toBe('us');
  });

  // ── New region detection ────────────────────────────────────────
  it('returns oceania for Sydney coordinates (-33.8, 151.2)', () => {
    expect(detectRegion(-33.8, 151.2)).toBe('oceania');
  });

  it('returns south_america for Rio de Janeiro coordinates (-22.9, -43.2)', () => {
    expect(detectRegion(-22.9, -43.2)).toBe('south_america');
  });

  it('returns africa for Nairobi coordinates (-1.3, 36.8)', () => {
    expect(detectRegion(-1.3, 36.8)).toBe('africa');
  });

  it('returns southeast_asia for Bangkok coordinates (13.7, 100.5)', () => {
    expect(detectRegion(13.7, 100.5)).toBe('southeast_asia');
  });

  it('returns europe for Iceland coordinates (64.1, -21.9)', () => {
    // Iceland falls within the Europe bounding box (lat 35-72, lng -25 to 45)
    expect(detectRegion(64.1, -21.9)).toBe('europe');
  });

  it('returns southeast_asia for Singapore coordinates (1.35, 103.8)', () => {
    expect(detectRegion(1.35, 103.8)).toBe('southeast_asia');
  });

  it('returns south_america for Patagonia coordinates (-50.3, -72.3)', () => {
    expect(detectRegion(-50.3, -72.3)).toBe('south_america');
  });

  it('returns africa for Cape Town coordinates (-33.9, 18.4)', () => {
    expect(detectRegion(-33.9, 18.4)).toBe('africa');
  });

  it('returns oceania for Gold Coast coordinates (-28.0, 153.4)', () => {
    expect(detectRegion(-28.0, 153.4)).toBe('oceania');
  });
});

describe('GOLDEN_LOCATIONS', () => {
  it('has at least 22 entries', () => {
    expect(GOLDEN_LOCATIONS.length).toBeGreaterThanOrEqual(22);
  });

  it('covers at minimum 7 distinct regions', () => {
    const regions = new Set(GOLDEN_LOCATIONS.map(l => l.expectedRegion));
    expect(regions.size).toBeGreaterThanOrEqual(7);
  });

  it('includes locations from US, Europe, Japan, South America, Africa, Oceania, and Southeast Asia', () => {
    const regions = new Set(GOLDEN_LOCATIONS.map(l => l.expectedRegion));
    expect(regions.has('us')).toBe(true);
    expect(regions.has('europe')).toBe(true);
    expect(regions.has('japan')).toBe(true);
    expect(regions.has('south_america')).toBe(true);
    expect(regions.has('africa')).toBe(true);
    expect(regions.has('oceania')).toBe(true);
    expect(regions.has('southeast_asia')).toBe(true);
  });

  it('every entry has required fields: name, lat, lng, expectedRegion, expectedTrailTypes, distanceKm', () => {
    for (const loc of GOLDEN_LOCATIONS) {
      expect(loc).toHaveProperty('name');
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lng).toBe('number');
      expect(typeof loc.expectedRegion).toBe('string');
      expect(Array.isArray(loc.expectedTrailTypes)).toBe(true);
      expect(loc.expectedTrailTypes.length).toBeGreaterThan(0);
      expect(typeof loc.distanceKm).toBe('number');
    }
  });

  it('each location expectedRegion matches detectRegion result', () => {
    for (const loc of GOLDEN_LOCATIONS) {
      expect(detectRegion(loc.lat, loc.lng)).toBe(loc.expectedRegion);
    }
  });
});

describe('REGION_WEIGHTS for new regions', () => {
  const requiredKeys = ['surface', 'continuity', 'trailPreference', 'scenic', 'greenSpace'];

  for (const region of ['south_america', 'africa', 'oceania', 'southeast_asia']) {
    describe(region, () => {
      it('has a weight profile in REGION_WEIGHTS', () => {
        expect(REGION_WEIGHTS).toHaveProperty(region);
      });

      it('has all 5 required weight keys', () => {
        const weights = REGION_WEIGHTS[region];
        for (const key of requiredKeys) {
          expect(weights).toHaveProperty(key);
          expect(typeof weights[key]).toBe('number');
        }
      });

      it('sums to 1.0', () => {
        const weights = REGION_WEIGHTS[region];
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      });

      it('returns a valid weight profile from getWeightsForRegion()', () => {
        const weights = getWeightsForRegion(region);
        expect(weights).toBeDefined();
        for (const key of requiredKeys) {
          expect(weights).toHaveProperty(key);
        }
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      });
    });
  }
});
