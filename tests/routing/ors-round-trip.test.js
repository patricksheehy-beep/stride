import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORSAdapter } from '../../src/routing/adapters/ors.js';

describe('ORSAdapter.roundTrip', () => {
  let adapter;

  beforeEach(() => {
    adapter = new ORSAdapter('test-api-key');
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.0, 37.4],
          [-122.01, 37.41],
          [-122.02, 37.42],
          [-122.01, 37.41],
          [-122.0, 37.4]
        ]
      },
      properties: { summary: { distance: 5.0, duration: 3600 } }
    }]
  };

  describe('request construction', () => {
    it('sends POST to /v2/directions/foot-hiking/geojson', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/directions/foot-hiking/geojson'),
        expect.any(Object)
      );
    });

    it('sends single coordinate in coordinates array (not two)', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.coordinates).toEqual([[-122.0, 37.4]]);
      expect(body.coordinates).toHaveLength(1);
    });

    it('contains options.round_trip.length in METERS', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 }, { length: 5000 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.round_trip.length).toBe(5000);
    });

    it('contains options.round_trip.points defaulting to 5', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.round_trip.points).toBe(5);
    });

    it('contains options.round_trip.seed matching seed parameter', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 }, { seed: 42 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.round_trip.seed).toBe(42);
    });

    it('does NOT contain alternative_routes', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.alternative_routes).toBeUndefined();
      expect(body.options.alternative_routes).toBeUndefined();
    });

    it('contains profile_params with green and quiet factors', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve(mockGeoJSON) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await adapter.roundTrip({ lat: 37.4, lng: -122.0 });

      const callArgs = fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.profile_params.weightings.green.factor).toBe(1.0);
      expect(body.options.profile_params.weightings.quiet.factor).toBe(1.0);
    });
  });

  describe('error handling', () => {
    it('throws on 429 rate limit', async () => {
      const mockResponse = { ok: false, status: 429, json: () => Promise.resolve({}) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await expect(adapter.roundTrip({ lat: 37.4, lng: -122.0 }))
        .rejects.toThrow('ORS rate limit exceeded');
    });

    it('throws on non-200 responses', async () => {
      const mockResponse = { ok: false, status: 500, json: () => Promise.resolve({}) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await expect(adapter.roundTrip({ lat: 37.4, lng: -122.0 }))
        .rejects.toThrow('ORS round trip error: 500');
    });
  });
});
