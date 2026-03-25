import { describe, it, expect } from 'vitest';
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
});
