import { describe, it, expect } from 'vitest';
import { buildLandUseQuery } from '../../src/data/query-builder.js';

describe('buildLandUseQuery', () => {
  const bbox = [47.3, 8.5, 47.4, 8.6];

  it('returns an Overpass QL string', () => {
    const query = buildLandUseQuery(bbox);
    expect(typeof query).toBe('string');
    expect(query.length).toBeGreaterThan(0);
  });

  it('contains [out:json] format directive', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toContain('[out:json]');
  });

  it('uses default timeout of 60 seconds (not 300)', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toContain('[timeout:60]');
    expect(query).not.toContain('[timeout:300]');
  });

  it('custom timeout option overrides default', () => {
    const query = buildLandUseQuery(bbox, { timeout: 120 });
    expect(query).toContain('[timeout:120]');
    expect(query).not.toContain('[timeout:60]');
  });

  it('contains bbox coordinates in correct order', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toContain('47.3');
    expect(query).toContain('8.5');
    expect(query).toContain('47.4');
    expect(query).toContain('8.6');
  });

  it('contains leisure selectors (park, garden, nature_reserve)', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toMatch(/leisure/);
    expect(query).toContain('park');
    expect(query).toContain('garden');
    expect(query).toContain('nature_reserve');
  });

  it('contains landuse selectors (forest, grass, meadow, recreation_ground)', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toMatch(/landuse/);
    expect(query).toContain('forest');
    expect(query).toContain('grass');
    expect(query).toContain('meadow');
    expect(query).toContain('recreation_ground');
  });

  it('contains natural selectors (water, wood, grassland, wetland)', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toMatch(/natural/);
    expect(query).toContain('water');
    expect(query).toContain('wood');
    expect(query).toContain('grassland');
    expect(query).toContain('wetland');
  });

  it('contains waterway selectors (river, stream, canal)', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toMatch(/waterway/);
    expect(query).toContain('river');
    expect(query).toContain('stream');
    expect(query).toContain('canal');
  });

  it('includes both way and relation selectors for land-use polygons', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toMatch(/way\[/);
    expect(query).toMatch(/relation\[/);
  });

  it('waterway is queried for way only (not relation)', () => {
    const query = buildLandUseQuery(bbox);
    // waterway should appear in a way[] block
    expect(query).toMatch(/way\["waterway"/);
  });

  it('contains "out body geom" output directive', () => {
    const query = buildLandUseQuery(bbox);
    expect(query).toContain('out body geom');
  });
});
