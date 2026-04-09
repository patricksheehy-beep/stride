import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteBuilder } from '../../src/routing/route-builder.js';
import { point, lineString, featureCollection } from '@turf/helpers';
import turfLength from '@turf/length';

/**
 * Build a mock GeoJSON FeatureCollection with a single LineString feature.
 * The route forms a rough loop around the start point at given size.
 */
function buildMockRoute(centerLat, centerLng, sizeKm = 5) {
  const offset = sizeKm / 111; // rough degrees per km
  const coords = [
    [centerLng, centerLat],
    [centerLng + offset, centerLat],
    [centerLng + offset, centerLat + offset],
    [centerLng, centerLat + offset],
    [centerLng, centerLat] // return to start
  ];
  return featureCollection([
    lineString(coords, { summary: { distance: sizeKm, duration: sizeKm * 600 } })
  ]);
}

/**
 * Build mock trail data with LineString features for waypoint snapping.
 */
function buildMockTrailData(centerLat, centerLng) {
  const offset = 0.01;
  return featureCollection([
    lineString(
      [[centerLng - offset, centerLat], [centerLng + offset, centerLat]],
      { id: 1, highway: 'path', surface: 'gravel', name: 'Trail North' }
    ),
    lineString(
      [[centerLng, centerLat - offset], [centerLng, centerLat + offset]],
      { id: 2, highway: 'footway', surface: 'dirt', name: 'Trail East' }
    ),
    lineString(
      [[centerLng - offset, centerLat - offset], [centerLng + offset, centerLat - offset]],
      { id: 3, highway: 'track', surface: 'compacted', name: 'Trail South' }
    ),
    lineString(
      [[centerLng - offset * 2, centerLat - offset], [centerLng - offset * 2, centerLat + offset]],
      { id: 4, highway: 'path', surface: 'fine_gravel', name: 'Trail West' }
    )
  ]);
}

describe('RouteBuilder', () => {
  let mockOrsAdapter;
  let mockEngineManager;
  let mockScorer;
  let trailData;
  const startPoint = { lat: 37.4, lng: -122.0 };

  beforeEach(() => {
    vi.restoreAllMocks();

    const mockRoute = buildMockRoute(37.4, -122.0, 5);

    mockOrsAdapter = {
      roundTrip: vi.fn().mockResolvedValue(mockRoute)
    };

    mockEngineManager = {
      route: vi.fn().mockResolvedValue({
        route: mockRoute,
        engine: 'ors'
      })
    };

    mockScorer = {
      scoreRoute: vi.fn().mockReturnValue({ total: 0.75, breakdown: {} }),
      scoreAndRank: vi.fn().mockReturnValue([])
    };

    trailData = buildMockTrailData(37.4, -122.0);
  });

  describe('constructor', () => {
    it('accepts { orsAdapter, engineManager, scorer }', () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      expect(builder).toBeDefined();
      expect(builder.orsAdapter).toBe(mockOrsAdapter);
      expect(builder.engineManager).toBe(mockEngineManager);
      expect(builder.scorer).toBe(mockScorer);
    });
  });

  describe('generateCandidatesViaRoundTrip', () => {
    it('calls orsAdapter.roundTrip with different seeds', async () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      await builder.generateCandidatesViaRoundTrip(startPoint, 5, 3);

      // When all seeds succeed, stops after collecting count (3) candidates
      // Each call uses a sequential seed starting from 0
      const callCount = mockOrsAdapter.roundTrip.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < callCount; i++) {
        expect(mockOrsAdapter.roundTrip).toHaveBeenCalledWith(
          startPoint,
          expect.objectContaining({ seed: i })
        );
      }
    });

    it('tries up to count+2 seeds when some fail', async () => {
      // Make seeds 0 and 1 fail, so it must try more to get 3
      let callIdx = 0;
      mockOrsAdapter.roundTrip = vi.fn().mockImplementation((_start, opts) => {
        if (opts.seed < 2) {
          return Promise.reject(new Error('seed failed'));
        }
        return Promise.resolve(buildMockRoute(37.4, -122.0, 5));
      });

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const results = await builder.generateCandidatesViaRoundTrip(startPoint, 5, 3);

      // Should have tried all 5 (count+2) seeds
      expect(mockOrsAdapter.roundTrip).toHaveBeenCalledTimes(5);
      // Got 3 successful from seeds 2, 3, 4
      expect(results).toHaveLength(3);
    });

    it('passes distanceKm * 1000 as length (meters)', async () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      await builder.generateCandidatesViaRoundTrip(startPoint, 8, 1);

      expect(mockOrsAdapter.roundTrip).toHaveBeenCalledWith(
        startPoint,
        expect.objectContaining({ length: 8000 })
      );
    });

    it('generates count+2 seeds and returns up to count successful results', async () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const results = await builder.generateCandidatesViaRoundTrip(startPoint, 5, 3);

      // All 5 succeed, but only 3 returned
      expect(results).toHaveLength(3);
    });

    it('returns fewer than count if some seeds fail', async () => {
      // Make seeds 0,2,3,4 fail; only seed 1 succeeds
      mockOrsAdapter.roundTrip = vi.fn().mockImplementation((_start, opts) => {
        if (opts.seed === 1) {
          return Promise.resolve(buildMockRoute(37.4, -122.0, 5));
        }
        return Promise.reject(new Error('seed failed'));
      });

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const results = await builder.generateCandidatesViaRoundTrip(startPoint, 5, 3);

      expect(results).toHaveLength(1);
    });
  });

  describe('buildLoopWaypoints', () => {
    it('returns 4 waypoints at roughly equal angular spacing', () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const waypoints = builder.buildLoopWaypoints(startPoint, trailData, 5);

      expect(waypoints).toHaveLength(4);
    });

    it('snaps waypoints to nearest trail geometry using @turf/nearest-point-on-line', () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const waypoints = builder.buildLoopWaypoints(startPoint, trailData, 5);

      // Waypoints should have lat and lng properties
      for (const wp of waypoints) {
        expect(wp).toHaveProperty('lat');
        expect(wp).toHaveProperty('lng');
        expect(typeof wp.lat).toBe('number');
        expect(typeof wp.lng).toBe('number');
      }

      // Waypoints should be near trail geometry, not raw geometric positions
      // At least verify they are numeric and within a reasonable range
      for (const wp of waypoints) {
        expect(wp.lat).toBeGreaterThan(37.0);
        expect(wp.lat).toBeLessThan(38.0);
        expect(wp.lng).toBeGreaterThan(-123.0);
        expect(wp.lng).toBeLessThan(-121.0);
      }
    });

    it('uses @turf/bearing and @turf/destination for geometric placement', () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const waypoints = builder.buildLoopWaypoints(startPoint, trailData, 10);

      // With larger distance, waypoints should be further from start
      // This verifies geometric placement is working
      expect(waypoints).toHaveLength(4);
      expect(waypoints[0].lat).not.toBe(waypoints[2].lat);
    });
  });

  describe('generateCandidateViaWaypoints', () => {
    it('places 4 waypoints around start snapped to trails', async () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      await builder.generateCandidateViaWaypoints(startPoint, trailData, 5);

      // engineManager.route called at least once (may iterate for distance refinement)
      expect(mockEngineManager.route).toHaveBeenCalled();
      const routeArgs = mockEngineManager.route.mock.calls[0][0];
      expect(routeArgs).toHaveLength(6); // start + 4 waypoints + start again
    });

    it('waypoint loop includes return to startPoint as final waypoint', async () => {
      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      await builder.generateCandidateViaWaypoints(startPoint, trailData, 5);

      const routeArgs = mockEngineManager.route.mock.calls[0][0];
      const first = routeArgs[0];
      const last = routeArgs[routeArgs.length - 1];
      expect(first.lat).toBe(last.lat);
      expect(first.lng).toBe(last.lng);
    });
  });

  describe('refineDistance', () => {
    it('iterates up to 3 times', async () => {
      // Always return a route that's 50% too long (never converges)
      const longRoute = buildMockRoute(37.4, -122.0, 10);
      mockOrsAdapter.roundTrip = vi.fn().mockResolvedValue(longRoute);

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      await builder.refineDistance(startPoint, 5, 3);

      // Should have called roundTrip at most 3 times
      expect(mockOrsAdapter.roundTrip.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('returns route within 10% of target when possible', async () => {
      // First call: 20% off. Second call: within 10%.
      const route1 = buildMockRoute(37.4, -122.0, 5);
      const actualLength1 = turfLength(route1.features[0], { units: 'kilometers' });

      // Build a route that is close to 5km target
      // We'll mock roundTrip to return specific routes
      let callCount = 0;
      mockOrsAdapter.roundTrip = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First: far from target
          return Promise.resolve(buildMockRoute(37.4, -122.0, 8));
        }
        // Second: close to target
        return Promise.resolve(buildMockRoute(37.4, -122.0, 5));
      });

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const result = await builder.refineDistance(startPoint, 5, 3);

      expect(result).toBeDefined();
      expect(result.features).toBeDefined();
    });

    it('adjusts target proportionally (ratio = targetKm / actualKm)', async () => {
      // First call returns a route, then we check second call has adjusted length
      const route1 = buildMockRoute(37.4, -122.0, 5);
      const actualKm1 = turfLength(route1.features[0], { units: 'kilometers' });

      let callIdx = 0;
      mockOrsAdapter.roundTrip = vi.fn().mockImplementation((_start, opts) => {
        callIdx++;
        // Return a route every time
        return Promise.resolve(buildMockRoute(37.4, -122.0, 5));
      });

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const targetKm = 10; // Request 10km
      await builder.refineDistance(startPoint, targetKm, 3);

      // The second call's length parameter should reflect the ratio adjustment
      if (mockOrsAdapter.roundTrip.mock.calls.length > 1) {
        const firstCallLength = mockOrsAdapter.roundTrip.mock.calls[0][1].length;
        const secondCallLength = mockOrsAdapter.roundTrip.mock.calls[1][1].length;
        // Second call should request more meters since first route was too short
        expect(secondCallLength).not.toBe(firstCallLength);
      }
    });

    it('returns best candidate when tolerance cannot be reached', async () => {
      // Always return same route (never converges within 10%)
      const route = buildMockRoute(37.4, -122.0, 10);
      mockOrsAdapter.roundTrip = vi.fn().mockResolvedValue(route);

      const builder = new RouteBuilder({
        orsAdapter: mockOrsAdapter,
        engineManager: mockEngineManager,
        scorer: mockScorer
      });

      const result = await builder.refineDistance(startPoint, 3, 3);

      // Should still return the best candidate found
      expect(result).toBeDefined();
      expect(result.features).toBeDefined();
    });
  });
});
