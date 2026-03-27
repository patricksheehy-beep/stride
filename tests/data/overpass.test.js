import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeOverpassToGeoJSON, OverpassAdapter } from '../../src/data/adapters/overpass.js';

describe('normalizeOverpassToGeoJSON', () => {
  it('returns a FeatureCollection with type property', () => {
    const result = normalizeOverpassToGeoJSON({ elements: [] });
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toEqual([]);
  });

  it('converts a way element to a LineString Feature', () => {
    const data = {
      elements: [{
        type: 'way',
        id: 123,
        geometry: [
          { lat: 37.7, lon: -122.4 },
          { lat: 37.8, lon: -122.5 }
        ],
        tags: { highway: 'path', surface: 'gravel' }
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);

    const feature = result.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('LineString');
  });

  it('sets coordinates as [lon, lat] pairs from element.geometry', () => {
    const data = {
      elements: [{
        type: 'way',
        id: 123,
        geometry: [
          { lat: 37.7, lon: -122.4 },
          { lat: 37.8, lon: -122.5 }
        ],
        tags: { highway: 'path' }
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    const coords = result.features[0].geometry.coordinates;
    expect(coords[0]).toEqual([-122.4, 37.7]);
    expect(coords[1]).toEqual([-122.5, 37.8]);
  });

  it('copies element.tags into Feature properties plus id and osmType:way', () => {
    const data = {
      elements: [{
        type: 'way',
        id: 123,
        geometry: [{ lat: 37.7, lon: -122.4 }],
        tags: { highway: 'path', surface: 'gravel', name: 'Bay Trail' }
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    const props = result.features[0].properties;
    expect(props.id).toBe(123);
    expect(props.osmType).toBe('way');
    expect(props.highway).toBe('path');
    expect(props.surface).toBe('gravel');
    expect(props.name).toBe('Bay Trail');
  });

  it('extracts relation members as separate Features', () => {
    const data = {
      elements: [{
        type: 'relation',
        id: 456,
        tags: { route: 'hiking', name: 'Bay Trail', network: 'rwn' },
        members: [
          {
            type: 'way',
            ref: 789,
            geometry: [
              { lat: 37.7, lon: -122.4 },
              { lat: 37.8, lon: -122.5 }
            ],
            tags: { highway: 'footway' }
          },
          {
            type: 'way',
            ref: 790,
            geometry: [
              { lat: 37.8, lon: -122.5 },
              { lat: 37.9, lon: -122.6 }
            ],
            tags: { highway: 'path' }
          }
        ]
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    expect(result.features).toHaveLength(2);
  });

  it('sets relation member properties with relationId, relationName, routeType, network, osmType', () => {
    const data = {
      elements: [{
        type: 'relation',
        id: 456,
        tags: { route: 'hiking', name: 'Bay Trail', network: 'rwn' },
        members: [{
          type: 'way',
          ref: 789,
          geometry: [
            { lat: 37.7, lon: -122.4 },
            { lat: 37.8, lon: -122.5 }
          ],
          tags: { highway: 'footway' }
        }]
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    const props = result.features[0].properties;
    expect(props.id).toBe(789);
    expect(props.osmType).toBe('relation_member');
    expect(props.relationId).toBe(456);
    expect(props.relationName).toBe('Bay Trail');
    expect(props.routeType).toBe('hiking');
    expect(props.network).toBe('rwn');
  });

  it('ignores elements without geometry (nodes, incomplete ways)', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 37.7, lon: -122.4 },
        { type: 'way', id: 2, tags: { highway: 'path' } },
        {
          type: 'way',
          id: 3,
          geometry: [{ lat: 37.7, lon: -122.4 }],
          tags: { highway: 'footway' }
        }
      ]
    };

    const result = normalizeOverpassToGeoJSON(data);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.id).toBe(3);
  });

  it('ignores relation members without geometry', () => {
    const data = {
      elements: [{
        type: 'relation',
        id: 456,
        tags: { route: 'hiking', name: 'Trail' },
        members: [
          { type: 'way', ref: 789 },
          { type: 'node', ref: 100, lat: 37.7, lon: -122.4 },
          {
            type: 'way',
            ref: 790,
            geometry: [{ lat: 37.7, lon: -122.4 }],
            tags: { highway: 'path' }
          }
        ]
      }]
    };

    const result = normalizeOverpassToGeoJSON(data);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.id).toBe(790);
  });

  it('returns empty FeatureCollection for empty elements array', () => {
    const result = normalizeOverpassToGeoJSON({ elements: [] });
    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('handles mixed ways and relations in the same response', () => {
    const data = {
      elements: [
        {
          type: 'way',
          id: 100,
          geometry: [{ lat: 37.7, lon: -122.4 }],
          tags: { highway: 'path' }
        },
        {
          type: 'relation',
          id: 200,
          tags: { route: 'hiking', name: 'Mix Trail' },
          members: [{
            type: 'way',
            ref: 300,
            geometry: [{ lat: 37.8, lon: -122.5 }],
            tags: { highway: 'footway' }
          }]
        }
      ]
    };

    const result = normalizeOverpassToGeoJSON(data);
    expect(result.features).toHaveLength(2);
    expect(result.features[0].properties.osmType).toBe('way');
    expect(result.features[1].properties.osmType).toBe('relation_member');
  });
});

describe('OverpassAdapter', () => {
  it('creates an adapter with config.overpassEndpoint', () => {
    const adapter = new OverpassAdapter();
    expect(adapter.endpoint).toBe('https://overpass-api.de/api/interpreter');
  });

  it('has a fetchTrails method', () => {
    const adapter = new OverpassAdapter();
    expect(typeof adapter.fetchTrails).toBe('function');
  });

  it('has a fetchLandUse method', () => {
    const adapter = new OverpassAdapter();
    expect(typeof adapter.fetchLandUse).toBe('function');
  });
});

describe('OverpassAdapter.fetchLandUse', () => {
  const bbox = [47.3, 8.5, 47.4, 8.6];

  // Mock Overpass response with a closed way (park polygon)
  const mockOverpassResponse = {
    elements: [{
      type: 'way',
      id: 1001,
      geometry: [
        { lat: 47.3, lon: 8.5 },
        { lat: 47.3, lon: 8.6 },
        { lat: 47.4, lon: 8.6 },
        { lat: 47.3, lon: 8.5 }  // closed ring
      ],
      tags: { leisure: 'park', name: 'Test Park' }
    }]
  };

  let originalFetch;
  let cacheStore;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    cacheStore = {};

    // Mock cache module
    const cacheModule = await import('../../src/core/cache.js');
    vi.spyOn(cacheModule, 'getCached').mockImplementation(async (store, key) => {
      return cacheStore[`${store}:${key}`] || null;
    });
    vi.spyOn(cacheModule, 'setCache').mockImplementation(async (store, key, data, ttl) => {
      cacheStore[`${store}:${key}`] = data;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetchLandUse calls Overpass endpoint and returns normalized polygon FeatureCollection', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOverpassResponse
    });

    const adapter = new OverpassAdapter();
    const result = await adapter.fetchLandUse(bbox);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result.type).toBe('FeatureCollection');
    // The closed way should be converted to a Polygon
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('Polygon');
    expect(result.features[0].properties.leisure).toBe('park');
  });

  it('fetchLandUse uses buildLandUseQuery (query contains land-use tags)', async () => {
    let capturedBody = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url, opts) => {
      capturedBody = opts.body;
      return {
        ok: true,
        json: async () => ({ elements: [] })
      };
    });

    const adapter = new OverpassAdapter();
    await adapter.fetchLandUse(bbox);

    // The POST body should contain land-use query terms
    const decoded = decodeURIComponent(capturedBody);
    expect(decoded).toContain('leisure');
    expect(decoded).toContain('landuse');
    expect(decoded).toContain('natural');
  });

  it('fetchLandUse caches results in trails store with 7-day TTL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOverpassResponse
    });

    const cacheModule = await import('../../src/core/cache.js');
    const adapter = new OverpassAdapter();
    await adapter.fetchLandUse(bbox);

    // setCache should have been called with trails store and 7-day TTL
    expect(cacheModule.setCache).toHaveBeenCalledWith(
      'trails',
      `landuse:${bbox.join(',')}`,
      expect.objectContaining({ type: 'FeatureCollection' }),
      7 * 24 * 60 * 60 * 1000
    );
  });

  it('fetchLandUse returns cached data when cache hit occurs', async () => {
    const cachedData = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { cached: true } }]
    };

    const cacheModule = await import('../../src/core/cache.js');
    cacheModule.getCached.mockResolvedValue(cachedData);

    globalThis.fetch = vi.fn();

    const adapter = new OverpassAdapter();
    const result = await adapter.fetchLandUse(bbox);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toEqual(cachedData);
  });

  it('fetchLandUse falls back to secondary endpoint on primary failure', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Primary endpoint down');
      }
      return {
        ok: true,
        json: async () => ({ elements: [] })
      };
    });

    const adapter = new OverpassAdapter();
    const result = await adapter.fetchLandUse(bbox);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result.type).toBe('FeatureCollection');
  });
});
