import { describe, it, expect } from 'vitest';
import { buildTrailQuery } from '../../src/data/query-builder.js';

describe('buildTrailQuery', () => {
  const bbox = [37.7, -122.5, 37.8, -122.4];

  it('returns a string containing [out:json][timeout:300]', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('[out:json]');
    expect(query).toContain('[timeout:300]');
  });

  it('includes maxsize setting', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('[maxsize:536870912]');
  });

  it('contains all 8 highway types', () => {
    const query = buildTrailQuery(bbox);
    const highwayTypes = [
      'path', 'footway', 'track', 'cycleway',
      'pedestrian', 'bridleway', 'steps', 'living_street'
    ];
    for (const type of highwayTypes) {
      expect(query).toContain(type);
    }
  });

  it('contains route relation types: hiking, running, foot, fitness_trail', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('hiking');
    expect(query).toContain('running');
    expect(query).toContain('foot');
    expect(query).toContain('fitness_trail');
  });

  it('contains leisure types: track, nature_reserve', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('track');
    expect(query).toContain('nature_reserve');
  });

  it('contains access restriction filter for access tag', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toMatch(/\["access"!~.*private.*no.*\]/);
  });

  it('contains access restriction filter for foot tag', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toMatch(/\["foot"!~.*private.*no.*\]/);
  });

  it('contains "out body geom" output directive', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('out body geom');
  });

  it('uses the bbox coordinates in the query', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toContain('37.7');
    expect(query).toContain('-122.5');
    expect(query).toContain('37.8');
    expect(query).toContain('-122.4');
  });

  it('uses custom timeout when provided', () => {
    const query = buildTrailQuery(bbox, { timeout: 180 });
    expect(query).toContain('[timeout:180]');
    expect(query).not.toContain('[timeout:300]');
  });

  it('queries way elements for highway types', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toMatch(/way\["highway"/);
  });

  it('queries relation elements for route types', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toMatch(/relation\["route"/);
  });

  it('queries way elements for leisure types', () => {
    const query = buildTrailQuery(bbox);
    expect(query).toMatch(/way\["leisure"/);
  });
});
