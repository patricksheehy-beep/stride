import { describe, it, expect } from 'vitest';
import { OSRMAdapter, normalizeOSRMResponse } from '../../src/routing/adapters/osrm.js';

describe('OSRMAdapter', () => {
  describe('constructor', () => {
    it('sets baseUrl to OSRM public endpoint', () => {
      const adapter = new OSRMAdapter();
      expect(adapter.baseUrl).toBe('https://router.project-osrm.org');
    });
  });

  describe('buildUrl', () => {
    it('produces URL with /route/v1/foot/ and coordinates in lng,lat order', () => {
      const adapter = new OSRMAdapter();
      const waypoints = [
        { lat: 37.7, lng: -122.4 },
        { lat: 37.8, lng: -122.5 }
      ];
      const url = adapter.buildUrl(waypoints);
      expect(url).toContain('/route/v1/foot/-122.4,37.7;-122.5,37.8');
    });

    it('includes overview=full query parameter', () => {
      const adapter = new OSRMAdapter();
      const url = adapter.buildUrl([{ lat: 37.7, lng: -122.4 }]);
      expect(url).toContain('overview=full');
    });

    it('includes geometries=geojson query parameter', () => {
      const adapter = new OSRMAdapter();
      const url = adapter.buildUrl([{ lat: 37.7, lng: -122.4 }]);
      expect(url).toContain('geometries=geojson');
    });

    it('includes steps=false query parameter', () => {
      const adapter = new OSRMAdapter();
      const url = adapter.buildUrl([{ lat: 37.7, lng: -122.4 }]);
      expect(url).toContain('steps=false');
    });
  });
});

describe('normalizeOSRMResponse', () => {
  it('returns a GeoJSON FeatureCollection', () => {
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.5, 37.8]] },
        distance: 5000,
        duration: 3000
      }]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].type).toBe('Feature');
  });

  it('converts distance from meters to km', () => {
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry: { type: 'LineString', coordinates: [[-122.4, 37.7]] },
        distance: 5000,
        duration: 3000
      }]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.features[0].properties.distance).toBe(5);
  });

  it('preserves duration in seconds', () => {
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry: { type: 'LineString', coordinates: [[-122.4, 37.7]] },
        distance: 5000,
        duration: 3000
      }]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.features[0].properties.duration).toBe(3000);
  });

  it('sets engine property to osrm', () => {
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry: { type: 'LineString', coordinates: [[-122.4, 37.7]] },
        distance: 1000,
        duration: 600
      }]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.features[0].properties.engine).toBe('osrm');
  });

  it('preserves geometry from OSRM response', () => {
    const geometry = { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.5, 37.8]] };
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry,
        distance: 5000,
        duration: 3000
      }]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.features[0].geometry).toEqual(geometry);
  });

  it('handles multiple routes', () => {
    const osrmResponse = {
      code: 'Ok',
      routes: [
        { geometry: { type: 'LineString', coordinates: [[0, 0]] }, distance: 1000, duration: 600 },
        { geometry: { type: 'LineString', coordinates: [[1, 1]] }, distance: 2000, duration: 1200 }
      ]
    };
    const result = normalizeOSRMResponse(osrmResponse);
    expect(result.features).toHaveLength(2);
    expect(result.features[0].properties.distance).toBe(1);
    expect(result.features[1].properties.distance).toBe(2);
  });
});
