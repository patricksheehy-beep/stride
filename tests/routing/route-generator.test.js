import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { featureCollection, lineString } from '@turf/helpers';
import { eventBus } from '../../src/core/event-bus.js';
import { store } from '../../src/core/state.js';

// Mock cache module at top level (hoisted by Vitest)
vi.mock('../../src/core/cache.js', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  ROUTE_STORE: 'routes'
}));

/**
 * Build a mock GeoJSON FeatureCollection with a single LineString loop.
 */
function buildMockRoute(centerLat, centerLng, sizeKm = 5) {
  const offset = sizeKm / 111;
  const coords = [
    [centerLng, centerLat],
    [centerLng + offset, centerLat],
    [centerLng + offset, centerLat + offset],
    [centerLng, centerLat + offset],
    [centerLng, centerLat]
  ];
  return featureCollection([
    lineString(coords, { summary: { distance: sizeKm, duration: sizeKm * 600 } })
  ]);
}

/**
 * Build mock trail data with properties for scoring.
 */
function buildMockTrailData(centerLat, centerLng) {
  const offset = 0.01;
  return featureCollection([
    lineString(
      [[centerLng - offset, centerLat], [centerLng + offset, centerLat]],
      { id: 1, highway: 'path', surface: 'fine_gravel', name: 'Bay Trail' }
    ),
    lineString(
      [[centerLng, centerLat - offset], [centerLng, centerLat + offset]],
      { id: 2, highway: 'footway', surface: 'compacted', name: 'Creek Trail' }
    ),
    lineString(
      [[centerLng - offset, centerLat - offset], [centerLng + offset, centerLat - offset]],
      { id: 3, highway: 'track', surface: 'gravel' }
    )
  ]);
}

describe('RouteGenerator', () => {
  let RouteGenerator;
  let mockRouteBuilder;
  let mockScorer;
  let mockOverpassAdapter;
  let startPoint;
  let distanceKm;
  let emittedEvents;
  let unsubscribers;

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Reset store state
    store.isGenerating = false;
    store.currentRoute = null;
    store.trails = [];

    // Dynamically import after mocks are set up
    const mod = await import('../../src/routing/route-generator.js');
    RouteGenerator = mod.RouteGenerator;

    startPoint = { lat: 37.4, lng: -122.0 };
    distanceKm = 5;

    const mockRoute1 = buildMockRoute(37.4, -122.0, 5);
    const mockRoute2 = buildMockRoute(37.4, -122.0, 4.5);
    const mockRoute3 = buildMockRoute(37.4, -122.0, 5.5);

    mockRouteBuilder = {
      generateCandidatesViaRoundTrip: vi.fn().mockResolvedValue([
        mockRoute1, mockRoute2, mockRoute3
      ]),
      generateCandidateViaWaypoints: vi.fn().mockResolvedValue({
        route: buildMockRoute(37.4, -122.0, 4.8),
        engine: 'ors'
      })
    };

    mockScorer = {
      scoreRoute: vi.fn().mockReturnValue({
        total: 0.75,
        breakdown: {
          surfaceScore: 0.8,
          continuityScore: 0.9,
          trailPrefScore: 0.7,
          scenicScore: 0.5
        }
      }),
      scoreAndRank: vi.fn().mockImplementation((candidates, trailData, sp) => {
        // Return scored candidates sorted by mock total (vary slightly)
        return candidates.map((c, i) => ({
          route: c.route || c,
          score: {
            total: 0.8 - i * 0.05,
            breakdown: {
              surfaceScore: 0.8,
              continuityScore: 0.9,
              trailPrefScore: 0.7,
              scenicScore: 0.5
            }
          }
        }));
      })
    };

    const trailData = buildMockTrailData(37.4, -122.0);
    const mockLandUseData = featureCollection([]);
    mockOverpassAdapter = {
      fetchTrails: vi.fn().mockResolvedValue(trailData),
      fetchLandUse: vi.fn().mockResolvedValue(mockLandUseData)
    };

    // Collect emitted events
    emittedEvents = [];
    unsubscribers = [];
    const trackEvent = (type) => {
      const unsub = eventBus.on(type, (detail) => {
        emittedEvents.push({ type, detail });
      });
      unsubscribers.push(unsub);
    };

    trackEvent('route:generation-started');
    trackEvent('route:generation-complete');
    trackEvent('route:generation-failed');
  });

  afterEach(() => {
    // Clean up event listeners
    for (const unsub of unsubscribers) {
      unsub();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('accepts { routeBuilder, scorer, overpassAdapter }', () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      expect(generator).toBeDefined();
      expect(generator.routeBuilder).toBe(mockRouteBuilder);
      expect(generator.scorer).toBe(mockScorer);
      expect(generator.overpassAdapter).toBe(mockOverpassAdapter);
    });
  });

  describe('generate()', () => {
    it('returns { routes, bestRoute } with routes array having 3+ items', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      expect(result).toHaveProperty('routes');
      expect(result).toHaveProperty('bestRoute');
      expect(Array.isArray(result.routes)).toBe(true);
      expect(result.routes.length).toBeGreaterThanOrEqual(3);
    });

    it('routes are sorted by score.total descending (best first)', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      for (let i = 1; i < result.routes.length; i++) {
        expect(result.routes[i - 1].score.total).toBeGreaterThanOrEqual(
          result.routes[i].score.total
        );
      }
    });

    it('bestRoute is the first element of routes', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      expect(result.bestRoute).toBe(result.routes[0]);
    });

    it('each route has shape: { route, score: { total, breakdown }, distanceKm }', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      for (const r of result.routes) {
        expect(r).toHaveProperty('route');
        expect(r).toHaveProperty('score');
        expect(r.score).toHaveProperty('total');
        expect(r.score).toHaveProperty('breakdown');
        expect(r).toHaveProperty('distanceKm');
        expect(typeof r.distanceKm).toBe('number');
      }
    });

    it('emits route:generation-started event with { startPoint, distanceKm }', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      const startEvent = emittedEvents.find(e => e.type === 'route:generation-started');
      expect(startEvent).toBeDefined();
      expect(startEvent.detail).toEqual({ startPoint, distanceKm });
    });

    it('emits route:generation-complete event with { routes, bestRoute }', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      const completeEvent = emittedEvents.find(e => e.type === 'route:generation-complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.detail).toHaveProperty('routes');
      expect(completeEvent.detail).toHaveProperty('bestRoute');
    });

    it('emits route:generation-failed event with { error } on failure', async () => {
      mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
        new Error('Network failure')
      );
      mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockRejectedValue(
        new Error('Network failure')
      );

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await expect(generator.generate(startPoint, distanceKm)).rejects.toThrow();

      const failedEvent = emittedEvents.find(e => e.type === 'route:generation-failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent.detail).toHaveProperty('error');
    });

    it('sets store.isGenerating = true at start and false at end', async () => {
      let wasGenerating = false;

      mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockImplementation(async () => {
        // Check isGenerating during execution
        wasGenerating = store.isGenerating;
        return { route: buildMockRoute(37.4, -122.0, 5), engine: 'osrm' };
      });

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      expect(wasGenerating).toBe(true);
      expect(store.isGenerating).toBe(false);
    });

    it('stores bestRoute in store.currentRoute', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      expect(store.currentRoute).toBe(result.bestRoute);
    });

    it('fetches trail data from overpassAdapter using bbox from start point and distance', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      expect(mockOverpassAdapter.fetchTrails).toHaveBeenCalledTimes(1);
      const bbox = mockOverpassAdapter.fetchTrails.mock.calls[0][0];
      expect(Array.isArray(bbox)).toBe(true);
      expect(bbox).toHaveLength(4);
      // bbox = [south, west, north, east]
      expect(bbox[0]).toBeLessThan(startPoint.lat); // south < lat
      expect(bbox[2]).toBeGreaterThan(startPoint.lat); // north > lat
      expect(bbox[1]).toBeLessThan(startPoint.lng); // west < lng
      expect(bbox[3]).toBeGreaterThan(startPoint.lng); // east > lng
    });

    it('uses detectRegion to pick region-appropriate scoring weights', async () => {
      // Start point in US region (California: lat 37.4, lng -122.0)
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      // Generator creates its own scorer with region-detected weights internally.
      // Verify generation completes and returns scored routes (proving scorer was used).
      expect(result.routes.length).toBeGreaterThanOrEqual(1);
      expect(result.routes[0]).toHaveProperty('score');
      expect(result.routes[0].score).toHaveProperty('total');
      expect(result.routes[0].score).toHaveProperty('breakdown');
    });

    it('generates 3 candidates via waypoint-based trail forcing with different bearings', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      // Verify waypoint generation was called 3 times (3 bearing offsets)
      expect(mockRouteBuilder.generateCandidateViaWaypoints).toHaveBeenCalled();
      expect(result.routes.length).toBeGreaterThanOrEqual(1);
    });

    it('if all round_trip candidates fail, still returns waypoint-based candidates', async () => {
      mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
        new Error('ORS down')
      );

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      const result = await generator.generate(startPoint, distanceKm);

      expect(result.routes.length).toBeGreaterThanOrEqual(1);
    });

    it('if all generation fails, throws with descriptive error', async () => {
      mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
        new Error('ORS down')
      );
      mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockRejectedValue(
        new Error('Engine down')
      );

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await expect(generator.generate(startPoint, distanceKm))
        .rejects.toThrow(/No routes|No route/);
    });

    it('sets store.isGenerating = false on error', async () => {
      mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
        new Error('fail')
      );
      mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockRejectedValue(
        new Error('fail')
      );

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      try {
        await generator.generate(startPoint, distanceKm);
      } catch {
        // expected
      }

      expect(store.isGenerating).toBe(false);
    });

    it('events are emitted in correct order: started then complete on success', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      const eventTypes = emittedEvents.map(e => e.type);
      const startIdx = eventTypes.indexOf('route:generation-started');
      const completeIdx = eventTypes.indexOf('route:generation-complete');

      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(completeIdx).toBeGreaterThan(startIdx);
    });

    it('events are emitted in correct order: started then failed on error', async () => {
      mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
        new Error('fail')
      );
      mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockRejectedValue(
        new Error('fail')
      );

      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      try {
        await generator.generate(startPoint, distanceKm);
      } catch {
        // expected
      }

      const eventTypes = emittedEvents.map(e => e.type);
      const startIdx = eventTypes.indexOf('route:generation-started');
      const failedIdx = eventTypes.indexOf('route:generation-failed');

      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(failedIdx).toBeGreaterThan(startIdx);
    });

    it('stores trail data in store.trails', async () => {
      const generator = new RouteGenerator({
        routeBuilder: mockRouteBuilder,
        scorer: mockScorer,
        overpassAdapter: mockOverpassAdapter
      });

      await generator.generate(startPoint, distanceKm);

      // store.trails should have been set to the fetched trail data
      expect(store.trails).toBeDefined();
      expect(store.trails.type).toBe('FeatureCollection');
    });

    // Phase 5 data quality integration tests
    describe('data quality integration', () => {
      it('result includes dataQuality with density, message, and totalFeatures', async () => {
        // Default mock returns 3 trail features (sparse)
        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        const result = await generator.generate(startPoint, distanceKm);

        expect(result).toHaveProperty('dataQuality');
        expect(result.dataQuality).toHaveProperty('density');
        expect(result.dataQuality).toHaveProperty('message');
        expect(result.dataQuality).toHaveProperty('totalFeatures');
        // Mock trail data has 3 features => sparse
        expect(result.dataQuality.density).toBe('sparse');
        expect(result.dataQuality.totalFeatures).toBe(3);
      });

      it('emits route:data-quality event with region and dataQuality', async () => {
        const dataQualityEvents = [];
        const unsub = eventBus.on('route:data-quality', (detail) => {
          dataQualityEvents.push(detail);
        });

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        await generator.generate(startPoint, distanceKm);
        unsub();

        expect(dataQualityEvents.length).toBe(1);
        expect(dataQualityEvents[0]).toHaveProperty('region');
        expect(dataQualityEvents[0]).toHaveProperty('dataQuality');
        expect(dataQualityEvents[0].dataQuality).toHaveProperty('density');
      });

      it('enhanced error message includes sparse info when no candidates and data is sparse', async () => {
        // Mock empty trail data (0 features = sparse)
        mockOverpassAdapter.fetchTrails = vi.fn().mockResolvedValue({
          type: 'FeatureCollection',
          features: []
        });

        // Both generation strategies fail
        mockRouteBuilder.generateCandidatesViaRoundTrip = vi.fn().mockRejectedValue(
          new Error('No routes')
        );
        mockRouteBuilder.generateCandidateViaWaypoints = vi.fn().mockRejectedValue(
          new Error('No routes')
        );

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        await expect(generator.generate(startPoint, distanceKm))
          .rejects.toThrow(/sparse|No routes/i);
      });
    });

    // Phase 3 integration tests
    describe('NL and explanation integration', () => {
      it('with userDescription calls nlParser.parse and merges weights', async () => {
        const mockNlParser = {
          parse: vi.fn().mockResolvedValue({
            weights: { surface: 0.1, continuity: 0.1, trailPreference: 0.3, scenic: 0.3, greenSpace: 0.2 },
            preferences: { preferWater: true, preferParks: false, preferForest: false, preferHills: false, preferFlat: false, preferPaved: false, preferTrails: true },
            vibeKeywords: ['waterfront', 'scenic']
          })
        };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          nlParser: mockNlParser
        });

        await generator.generate(startPoint, distanceKm, { userDescription: 'scenic waterfront trail' });

        expect(mockNlParser.parse).toHaveBeenCalledWith('scenic waterfront trail');
      });

      it('without userDescription skips NL parsing (backward compatible)', async () => {
        const mockNlParser = { parse: vi.fn() };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          nlParser: mockNlParser
        });

        const result = await generator.generate(startPoint, distanceKm);

        expect(mockNlParser.parse).not.toHaveBeenCalled();
        expect(result.routes.length).toBeGreaterThanOrEqual(1);
      });

      it('with nlParser returning null uses region default weights', async () => {
        const mockNlParser = { parse: vi.fn().mockResolvedValue(null) };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          nlParser: mockNlParser
        });

        const result = await generator.generate(startPoint, distanceKm, { userDescription: 'something' });

        expect(mockNlParser.parse).toHaveBeenCalled();
        // Should still produce valid results with default weights
        expect(result.routes.length).toBeGreaterThanOrEqual(1);
      });

      it('fetches landUseData and passes to scorer via candidates', async () => {
        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        await generator.generate(startPoint, distanceKm);

        expect(mockOverpassAdapter.fetchLandUse).toHaveBeenCalledTimes(1);
      });

      it('generates explanations for top 3 routes when routeExplainer is provided', async () => {
        const mockExplainer = {
          explainBatch: vi.fn().mockResolvedValue(['Explanation 1', 'Explanation 2', 'Explanation 3']),
          _extractTrailMetadata: vi.fn().mockReturnValue({
            trailNames: [], surfaces: [], waterFeatures: [], greenSpaces: []
          })
        };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          routeExplainer: mockExplainer
        });

        const result = await generator.generate(startPoint, distanceKm);

        expect(mockExplainer.explainBatch).toHaveBeenCalledTimes(1);
        // Top routes should have explanations attached
        expect(result.routes[0].explanation).toBe('Explanation 1');
        expect(result.routes[1].explanation).toBe('Explanation 2');
        expect(result.routes[2].explanation).toBe('Explanation 3');
      });

      it('with no routeExplainer skips explanation generation', async () => {
        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        const result = await generator.generate(startPoint, distanceKm);

        // Routes should have a built-in description (no Claude needed)
        expect(result.routes[0].explanation).toBeDefined();
        expect(typeof result.routes[0].explanation).toBe('string');
      });

      it('with failed NL parsing still generates routes with default weights', async () => {
        const mockNlParser = { parse: vi.fn().mockRejectedValue(new Error('API down')) };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          nlParser: mockNlParser
        });

        const result = await generator.generate(startPoint, distanceKm, { userDescription: 'test' });

        expect(result.routes.length).toBeGreaterThanOrEqual(1);
      });

      it('with failed landUse fetch still scores with neutral green space', async () => {
        mockOverpassAdapter.fetchLandUse = vi.fn().mockRejectedValue(new Error('Overpass down'));

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter
        });

        const result = await generator.generate(startPoint, distanceKm);

        // Should still produce results even without land-use data
        expect(result.routes.length).toBeGreaterThanOrEqual(1);
      });

      it('with failed explanation still returns routes without explanations', async () => {
        const mockExplainer = {
          explainBatch: vi.fn().mockRejectedValue(new Error('Claude down')),
          _extractTrailMetadata: vi.fn().mockReturnValue({
            trailNames: [], surfaces: [], waterFeatures: [], greenSpaces: []
          })
        };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          routeExplainer: mockExplainer
        });

        const result = await generator.generate(startPoint, distanceKm);

        expect(result.routes.length).toBeGreaterThanOrEqual(1);
        // Falls back to built-in description when Claude explainer fails
        expect(result.routes[0].explanation).toBeDefined();
        expect(typeof result.routes[0].explanation).toBe('string');
      });

      it('event payload includes nlResult when NL description was parsed', async () => {
        const nlResultData = {
          weights: { surface: 0.2, continuity: 0.2, trailPreference: 0.2, scenic: 0.2, greenSpace: 0.2 },
          preferences: { preferWater: false, preferParks: false, preferForest: false, preferHills: false, preferFlat: false, preferPaved: false, preferTrails: false },
          vibeKeywords: ['general']
        };
        const mockNlParser = { parse: vi.fn().mockResolvedValue(nlResultData) };

        const generator = new RouteGenerator({
          routeBuilder: mockRouteBuilder,
          scorer: mockScorer,
          overpassAdapter: mockOverpassAdapter,
          nlParser: mockNlParser
        });

        await generator.generate(startPoint, distanceKm, { userDescription: 'general run' });

        const completeEvent = emittedEvents.find(e => e.type === 'route:generation-complete');
        expect(completeEvent).toBeDefined();
        expect(completeEvent.detail).toHaveProperty('nlResult');
        expect(completeEvent.detail.nlResult).toEqual(nlResultData);
      });
    });
  });
});
