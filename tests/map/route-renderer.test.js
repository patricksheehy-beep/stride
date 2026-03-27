/**
 * Tests for route-renderer.js
 * Covers extractTurnPoints and addDistanceMarkers logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock turf modules before importing the module under test
vi.mock('@turf/along', () => ({
  default: vi.fn((line, distance) => ({
    geometry: { coordinates: [distance * 0.01, 37.0 + distance * 0.001] }
  }))
}));

vi.mock('@turf/length', () => ({
  default: vi.fn(() => 5.2) // default 5.2 km route
}));

// Mock Leaflet
vi.mock('leaflet', () => {
  const mockMarker = {
    bindTooltip: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis()
  };
  const mockCircleMarker = {
    bindTooltip: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis()
  };
  const mockPolyline = {
    addTo: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({
      pad: vi.fn().mockReturnThis()
    }))
  };
  const mockLayerGroup = {
    addTo: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    removeFrom: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis()
  };

  return {
    default: {
      layerGroup: vi.fn(() => mockLayerGroup),
      polyline: vi.fn(() => mockPolyline),
      marker: vi.fn(() => mockMarker),
      circleMarker: vi.fn(() => mockCircleMarker),
      divIcon: vi.fn((opts) => opts),
      latLngBounds: vi.fn()
    }
  };
});

import { extractTurnPoints, addDistanceMarkers } from '../../src/map/route-renderer.js';

// Helper: build a mock ORS GeoJSON response with segments and steps
function buildMockRouteGeoJSON({ steps = [], coordinates = [] } = {}) {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        segments: [{
          steps
        }]
      }
    }]
  };
}

describe('extractTurnPoints', () => {
  it('correctly extracts instruction steps from ORS response and maps way_points index to coordinates', () => {
    const coords = [
      [-122.0, 37.0, 10],
      [-122.001, 37.001, 12],
      [-122.002, 37.002, 15],
      [-122.003, 37.003, 18],
      [-122.004, 37.004, 20]
    ];

    const steps = [
      { instruction: 'Head north on Trail A', distance: 0.5, duration: 120, type: 11, way_points: [0, 1] },
      { instruction: 'Turn left onto Path B', distance: 0.3, duration: 80, type: 0, way_points: [1, 3] },
      { instruction: 'Continue on Trail C', distance: 0.4, duration: 100, type: 6, way_points: [3, 4] }
    ];

    const geojson = buildMockRouteGeoJSON({ steps, coordinates: coords });
    const result = extractTurnPoints(geojson);

    expect(result).toHaveLength(3);

    // First step: way_points[0] = index 0 -> coords[0]
    expect(result[0]).toEqual({
      lat: 37.0,
      lng: -122.0,
      ele: 10,
      instruction: 'Head north on Trail A',
      distance: 0.5,
      type: 11
    });

    // Second step: way_points[0] = index 1 -> coords[1]
    expect(result[1]).toEqual({
      lat: 37.001,
      lng: -122.001,
      ele: 12,
      instruction: 'Turn left onto Path B',
      distance: 0.3,
      type: 0
    });

    // Third step: way_points[0] = index 3 -> coords[3]
    expect(result[2]).toEqual({
      lat: 37.003,
      lng: -122.003,
      ele: 18,
      instruction: 'Continue on Trail C',
      distance: 0.4,
      type: 6
    });
  });

  it('returns empty array when no segments or steps in route properties', () => {
    // No segments at all
    const noSegments = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-122, 37]] },
        properties: {}
      }]
    };
    expect(extractTurnPoints(noSegments)).toEqual([]);

    // Empty steps
    const emptySteps = buildMockRouteGeoJSON({ steps: [], coordinates: [[-122, 37]] });
    expect(extractTurnPoints(emptySteps)).toEqual([]);

    // Null/undefined input
    expect(extractTurnPoints(null)).toEqual([]);
    expect(extractTurnPoints(undefined)).toEqual([]);

    // Empty features
    expect(extractTurnPoints({ type: 'FeatureCollection', features: [] })).toEqual([]);
  });
});

describe('addDistanceMarkers', () => {
  let mockMap;

  beforeEach(() => {
    const mockLayerGroup = {
      addTo: vi.fn().mockReturnThis(),
      addLayer: vi.fn().mockReturnThis(),
      removeFrom: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis()
    };
    mockMap = {
      _strideRouteGroup: mockLayerGroup,
      fitBounds: vi.fn()
    };
  });

  it('generates correct number of markers for a 5km route at 1km interval (4 markers at km 1,2,3,4)', async () => {
    // The mock @turf/length returns 5.2 by default
    const routeFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-122.0, 37.0], [-122.05, 37.05]]
      }
    };

    const markers = addDistanceMarkers(mockMap, routeFeature, 1);

    // 5.2km route, 1km interval: markers at 1, 2, 3, 4, 5 = 5 markers
    expect(markers).toHaveLength(5);
  });

  it('returns empty array for route shorter than interval', async () => {
    // Override mock to return short route
    const turfLength = await import('@turf/length');
    turfLength.default.mockReturnValueOnce(0.5); // 500m route

    const routeFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-122.0, 37.0], [-122.001, 37.001]]
      }
    };

    const markers = addDistanceMarkers(mockMap, routeFeature, 1);
    expect(markers).toHaveLength(0);
  });
});
