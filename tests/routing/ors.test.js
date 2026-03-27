import { describe, it, expect } from 'vitest';
import { ORSAdapter } from '../../src/routing/adapters/ors.js';

describe('ORSAdapter', () => {
  describe('constructor', () => {
    it('stores the provided API key', () => {
      const adapter = new ORSAdapter('test-api-key');
      expect(adapter.apiKey).toBe('test-api-key');
    });

    it('sets baseUrl to ORS API endpoint', () => {
      const adapter = new ORSAdapter('test-api-key');
      expect(adapter.baseUrl).toBe('https://api.openrouteservice.org');
    });
  });

  describe('buildRequestBody', () => {
    it('converts waypoints from {lat,lng} to [lng,lat] order for ORS API', () => {
      const adapter = new ORSAdapter('test-api-key');
      const waypoints = [
        { lat: 37.7, lng: -122.4 },
        { lat: 37.8, lng: -122.5 }
      ];
      const body = adapter.buildRequestBody(waypoints);
      expect(body.coordinates).toEqual([
        [-122.4, 37.7],
        [-122.5, 37.8]
      ]);
    });

    it('sets preference to recommended', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.preference).toBe('recommended');
    });

    it('sets green factor to 1.0', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.options.profile_params.weightings.green.factor).toBe(1.0);
    });

    it('sets quiet factor to 1.0', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.options.profile_params.weightings.quiet.factor).toBe(1.0);
    });

    it('includes units as km and geometry as true', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.units).toBe('km');
      expect(body.geometry).toBe(true);
    });

    it('sets instructions to true', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.instructions).toBe(true);
    });

    it('includes elevation: true in the request body', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.elevation).toBe(true);
    });

    it('includes instructions_format as text', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.instructions_format).toBe('text');
    });
  });

  describe('roundTrip', () => {
    it('includes elevation: true in round trip request body', async () => {
      const adapter = new ORSAdapter('test-api-key');
      let capturedBody = null;

      // Mock fetch to capture the request body
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features: [] }) };
      };

      try {
        await adapter.roundTrip({ lat: 37.7, lng: -122.4 }, { length: 5000 });
        expect(capturedBody.elevation).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('includes instructions: true in round trip request body', async () => {
      const adapter = new ORSAdapter('test-api-key');
      let capturedBody = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features: [] }) };
      };

      try {
        await adapter.roundTrip({ lat: 37.7, lng: -122.4 });
        expect(capturedBody.instructions).toBe(true);
        expect(capturedBody.instructions_format).toBe('text');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
