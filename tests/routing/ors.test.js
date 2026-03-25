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

    it('sets instructions to false', () => {
      const adapter = new ORSAdapter('test-api-key');
      const body = adapter.buildRequestBody([{ lat: 37.7, lng: -122.4 }]);
      expect(body.instructions).toBe(false);
    });
  });
});
