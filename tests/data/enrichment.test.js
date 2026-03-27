import { describe, it, expect } from 'vitest';
import { normalizeToPolygons } from '../../src/data/enrichment.js';

describe('normalizeToPolygons', () => {
  it('returns a valid GeoJSON FeatureCollection', () => {
    const input = { type: 'FeatureCollection', features: [] };
    const result = normalizeToPolygons(input);
    expect(result.type).toBe('FeatureCollection');
    expect(Array.isArray(result.features)).toBe(true);
  });

  it('empty FeatureCollection input returns empty FeatureCollection output', () => {
    const input = { type: 'FeatureCollection', features: [] };
    const result = normalizeToPolygons(input);
    expect(result.features).toHaveLength(0);
  });

  it('converts closed LineString (first coord == last coord, >= 4 coords) to Polygon', () => {
    const closedWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [8.5, 47.3],
          [8.6, 47.3],
          [8.6, 47.4],
          [8.5, 47.3]  // closes the ring
        ]
      },
      properties: { leisure: 'park', name: 'Test Park' }
    };
    const input = { type: 'FeatureCollection', features: [closedWay] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('Polygon');
    expect(result.features[0].geometry.coordinates).toEqual([
      [[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]
    ]);
  });

  it('preserves properties from original features on converted polygons', () => {
    const closedWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]
        ]
      },
      properties: { leisure: 'park', name: 'Central Park', id: 42 }
    };
    const input = { type: 'FeatureCollection', features: [closedWay] };
    const result = normalizeToPolygons(input);

    expect(result.features[0].properties.leisure).toBe('park');
    expect(result.features[0].properties.name).toBe('Central Park');
    expect(result.features[0].properties.id).toBe(42);
  });

  it('filters out open LineString (first != last coord)', () => {
    const openWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.7, 47.4]
        ]
      },
      properties: { highway: 'path' }
    };
    const input = { type: 'FeatureCollection', features: [openWay] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(0);
  });

  it('filters out LineString with fewer than 4 coordinates', () => {
    const shortWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [8.5, 47.3], [8.6, 47.3], [8.5, 47.3]
        ]
      },
      properties: { leisure: 'park' }
    };
    const input = { type: 'FeatureCollection', features: [shortWay] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(0);
  });

  it('passes through existing Polygon features unchanged', () => {
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]]
      },
      properties: { landuse: 'forest' }
    };
    const input = { type: 'FeatureCollection', features: [polygon] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual(polygon);
  });

  it('passes through existing MultiPolygon features unchanged', () => {
    const multiPolygon = {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]]]
      },
      properties: { natural: 'water' }
    };
    const input = { type: 'FeatureCollection', features: [multiPolygon] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual(multiPolygon);
  });

  it('skips non-polygon geometry types (Point, MultiLineString)', () => {
    const point = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [8.5, 47.3] },
      properties: {}
    };
    const multiLine = {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [[[8.5, 47.3], [8.6, 47.3]]]
      },
      properties: {}
    };
    const input = { type: 'FeatureCollection', features: [point, multiLine] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(0);
  });

  it('handles mixed features: keeps Polygon and closed LineString, drops open LineString', () => {
    const closedWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]
      },
      properties: { leisure: 'park' }
    };
    const openWay = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[8.5, 47.3], [8.6, 47.3], [8.6, 47.4]]
      },
      properties: { highway: 'path' }
    };
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]]
      },
      properties: { natural: 'water' }
    };
    const input = { type: 'FeatureCollection', features: [closedWay, openWay, polygon] };
    const result = normalizeToPolygons(input);

    expect(result.features).toHaveLength(2);
    expect(result.features[0].geometry.type).toBe('Polygon');
    expect(result.features[1].geometry.type).toBe('Polygon');
  });
});
