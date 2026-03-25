import { describe, it, expect } from 'vitest';
import { regionProfiles, detectRegion } from '../../src/data/region-profiles.js';

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
});

describe('detectRegion', () => {
  it('returns japan for Tokyo coordinates (35.6, 139.7)', () => {
    expect(detectRegion(35.6, 139.7)).toBe('japan');
  });

  it('returns europe for Paris coordinates (48.8, 2.3)', () => {
    expect(detectRegion(48.8, 2.3)).toBe('europe');
  });

  it('returns us for New York coordinates (40.7, -74.0)', () => {
    expect(detectRegion(40.7, -74.0)).toBe('us');
  });

  it('returns default for Sydney coordinates (-33.8, 151.2)', () => {
    expect(detectRegion(-33.8, 151.2)).toBe('default');
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
});
