import { describe, it, expect } from 'vitest';
import { GOLDEN_LOCATIONS } from './fixtures.js';
import { buildTrailQuery } from '../../src/data/query-builder.js';

describe('Golden Test: Query Coverage', () => {
  // Generic bbox for testing query output
  const genericBbox = [37.0, -122.5, 37.5, -122.0];
  const queryString = buildTrailQuery(genericBbox);

  describe('highway type coverage', () => {
    const allHighwayTypes = [
      'path', 'footway', 'track', 'cycleway',
      'pedestrian', 'bridleway', 'steps', 'living_street'
    ];

    for (const hwType of allHighwayTypes) {
      it(`includes highway type "${hwType}" in the query`, () => {
        expect(queryString).toContain(hwType);
      });
    }
  });

  describe('access restriction filters', () => {
    it('includes access restriction filter', () => {
      expect(queryString).toMatch(/"access"!~/);
    });

    it('includes foot restriction filter', () => {
      expect(queryString).toMatch(/"foot"!~/);
    });
  });

  describe('route relation types', () => {
    const routeTypes = ['hiking', 'running', 'foot', 'fitness_trail'];

    for (const routeType of routeTypes) {
      it(`includes route relation type "${routeType}"`, () => {
        expect(queryString).toContain(routeType);
      });
    }
  });

  describe('per-location trail type coverage', () => {
    for (const loc of GOLDEN_LOCATIONS) {
      it(`query covers all expected trail types for ${loc.name}`, () => {
        // buildTrailQuery queries ALL highway types regardless of region,
        // so every location's expectedTrailTypes should appear in the query.
        // This catches regressions if someone accidentally removes a highway type.
        const query = buildTrailQuery(genericBbox);
        for (const trailType of loc.expectedTrailTypes) {
          expect(query).toContain(trailType);
        }
      });
    }
  });
});
