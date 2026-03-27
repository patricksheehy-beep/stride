/**
 * Tests for scoring Web Worker logic equivalence.
 *
 * Since Web Workers don't work in jsdom/vitest, we test:
 * 1. RouteScorer determinism: same input => same output
 * 2. Sorting is descending by total
 * 3. Error handling for invalid data (empty candidates)
 * 4. RouteGenerator graceful degradation when Worker is unavailable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteScorer } from '../../src/scoring/scorer.js';
import { DEFAULT_WEIGHTS } from '../../src/scoring/weights.js';
import { featureCollection, lineString } from '@turf/helpers';

// Mock cache module at top level (required for RouteGenerator import in fallback test)
vi.mock('../../src/core/cache.js', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  ROUTE_STORE: 'routes'
}));

// ── Test fixtures ──────────────────────────────────────────────────

function makeRoute(coords) {
  return featureCollection([lineString(coords)]);
}

function makeTrailData(features) {
  return featureCollection(
    features.map(({ coords, ...props }) =>
      lineString(coords || [[-122.03, 37.38], [-122.025, 37.38]], props)
    )
  );
}

// Route A: trail-heavy
const trailRoute = makeRoute([
  [-122.05, 37.38], [-122.04, 37.38], [-122.03, 37.38],
  [-122.02, 37.38], [-122.01, 37.38]
]);
const trailData = makeTrailData([
  { coords: [[-122.05, 37.38], [-122.03, 37.38]], highway: 'path', surface: 'fine_gravel', routeType: 'hiking' },
  { coords: [[-122.03, 37.38], [-122.01, 37.38]], highway: 'footway', surface: 'compacted', natural: 'wood' }
]);

// Route B: road-heavy
const roadRoute = makeRoute([
  [-122.05, 37.38], [-122.04, 37.38], [-122.03, 37.38],
  [-122.02, 37.38], [-122.01, 37.38]
]);
const roadData = makeTrailData([
  { coords: [[-122.05, 37.38], [-122.03, 37.38]], highway: 'residential', surface: 'asphalt' },
  { coords: [[-122.03, 37.38], [-122.01, 37.38]], highway: 'tertiary', surface: 'concrete' }
]);

// Route C: mixed
const mixedRoute = makeRoute([
  [-122.06, 37.38], [-122.05, 37.38], [-122.04, 37.38],
  [-122.03, 37.38], [-122.02, 37.38]
]);
const mixedData = makeTrailData([
  { coords: [[-122.06, 37.38], [-122.04, 37.38]], highway: 'cycleway', surface: 'asphalt' },
  { coords: [[-122.04, 37.38], [-122.02, 37.38]], highway: 'path', surface: 'gravel' }
]);

const startPoint = [-122.05, 37.38];

// ── Tests ──────────────────────────────────────────────────────────

describe('Scoring Worker Logic Equivalence', () => {
  describe('determinism', () => {
    it('scoreAndRank produces identical results when called twice with same input', () => {
      const scorer = new RouteScorer(DEFAULT_WEIGHTS);
      const candidates = [
        { route: trailRoute, trailData },
        { route: roadRoute, trailData: roadData },
        { route: mixedRoute, trailData: mixedData }
      ];

      const result1 = scorer.scoreAndRank(candidates, startPoint);
      const result2 = scorer.scoreAndRank(candidates, startPoint);

      expect(result1.length).toBe(result2.length);
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].score.total).toBe(result2[i].score.total);
        expect(result1[i].score.breakdown).toEqual(result2[i].score.breakdown);
      }
    });

    it('scoreAndRank with custom weights produces identical results on repeated calls', () => {
      const customWeights = { surface: 0.10, continuity: 0.10, trailPreference: 0.40, scenic: 0.20, greenSpace: 0.20 };
      const scorer = new RouteScorer(customWeights);
      const candidates = [
        { route: trailRoute, trailData },
        { route: roadRoute, trailData: roadData }
      ];

      const result1 = scorer.scoreAndRank(candidates, startPoint);
      const result2 = scorer.scoreAndRank(candidates, startPoint);

      expect(result1[0].score.total).toBe(result2[0].score.total);
      expect(result1[1].score.total).toBe(result2[1].score.total);
    });
  });

  describe('sorting', () => {
    it('scoreAndRank returns results sorted by total score descending', () => {
      const scorer = new RouteScorer(DEFAULT_WEIGHTS);
      const candidates = [
        { route: roadRoute, trailData: roadData },
        { route: trailRoute, trailData },
        { route: mixedRoute, trailData: mixedData }
      ];

      const ranked = scorer.scoreAndRank(candidates, startPoint);

      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1].score.total).toBeGreaterThanOrEqual(ranked[i].score.total);
      }
    });

    it('best candidate (trail-heavy) is ranked first', () => {
      const scorer = new RouteScorer(DEFAULT_WEIGHTS);
      const candidates = [
        { route: roadRoute, trailData: roadData },
        { route: trailRoute, trailData }
      ];

      const ranked = scorer.scoreAndRank(candidates, startPoint);

      // Trail-heavy should score higher than road-heavy
      expect(ranked[0].score.total).toBeGreaterThan(ranked[1].score.total);
    });
  });

  describe('error handling', () => {
    it('scoreAndRank with empty candidates returns empty array', () => {
      const scorer = new RouteScorer(DEFAULT_WEIGHTS);
      const ranked = scorer.scoreAndRank([], startPoint);

      expect(ranked).toEqual([]);
    });
  });
});

describe('RouteGenerator Worker Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('RouteGenerator constructor does not throw when Worker is unavailable', async () => {
    // Mock Worker constructor to throw (simulates environments without Worker support)
    const originalWorker = globalThis.Worker;
    globalThis.Worker = class {
      constructor() {
        throw new Error('Worker is not defined');
      }
    };

    const { RouteGenerator } = await import('../../src/routing/route-generator.js');

    expect(() => {
      new RouteGenerator({
        routeBuilder: {},
        scorer: {},
        overpassAdapter: {}
      });
    }).not.toThrow();

    // Restore
    globalThis.Worker = originalWorker;
  });
});
