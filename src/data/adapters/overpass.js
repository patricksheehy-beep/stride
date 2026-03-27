/**
 * Overpass API adapter with GeoJSON normalization and cache integration.
 * Fetches trail data using comprehensive queries, normalizes responses
 * to standard GeoJSON FeatureCollection, and caches results in IndexedDB.
 */
import { buildTrailQuery, buildLandUseQuery } from '../query-builder.js';
import { normalizeToPolygons } from '../enrichment.js';
import { config } from '../../core/config.js';
import { getCached, setCache } from '../../core/cache.js';
import { eventBus } from '../../core/event-bus.js';

/**
 * Normalize Overpass API JSON response to a GeoJSON FeatureCollection.
 * Handles both way elements and relation elements with member ways.
 * Skips elements without geometry (nodes, incomplete ways).
 *
 * @param {Object} overpassData - Raw Overpass API JSON response
 * @param {Array} overpassData.elements - Array of OSM elements
 * @returns {Object} GeoJSON FeatureCollection
 */
export function normalizeOverpassToGeoJSON(overpassData) {
  const features = [];

  for (const element of overpassData.elements) {
    if (element.type === 'way' && element.geometry) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: element.geometry.map(n => [n.lon, n.lat])
        },
        properties: {
          id: element.id,
          osmType: 'way',
          ...element.tags
        }
      });
    } else if (element.type === 'relation' && element.members) {
      for (const member of element.members) {
        if (member.type === 'way' && member.geometry) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: member.geometry.map(n => [n.lon, n.lat])
            },
            properties: {
              id: member.ref,
              osmType: 'relation_member',
              relationId: element.id,
              relationName: element.tags?.name,
              routeType: element.tags?.route,
              network: element.tags?.network,
              ...member.tags
            }
          });
        }
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Overpass API adapter that fetches trail data using comprehensive queries,
 * normalizes responses to GeoJSON, and integrates with IndexedDB cache.
 */
export class OverpassAdapter {
  constructor() {
    this.endpoint = config.overpassEndpoint;
    this.fallbackEndpoint = config.overpassFallbackEndpoint;
  }

  /**
   * Fetch trail data for a bounding box.
   * Checks cache first, then queries Overpass API with automatic fallback.
   *
   * @param {number[]} bbox - Bounding box as [south, west, north, east]
   * @param {Object} [options={}] - Query options passed to buildTrailQuery
   * @returns {Promise<Object>} GeoJSON FeatureCollection of trail features
   */
  async fetchTrails(bbox, options = {}) {
    const cacheKey = `trails:${bbox.join(',')}`;

    // Check cache first
    const cached = await getCached('trails', cacheKey);
    if (cached) {
      eventBus.emit('data:cache-hit', { key: cacheKey });
      return cached;
    }

    // Build the comprehensive Overpass QL query
    const query = buildTrailQuery(bbox, options);

    // Try primary endpoint, fall back to secondary
    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        throw new Error(`Overpass error: ${response.status}`);
      }
    } catch (primaryError) {
      // Try fallback endpoint
      response = await fetch(this.fallbackEndpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        throw new Error(`Overpass fallback error: ${response.status}`);
      }
    }

    // Parse and normalize response
    const data = await response.json();
    const geojson = normalizeOverpassToGeoJSON(data);

    // Cache the result
    await setCache('trails', cacheKey, geojson);

    // Emit event with results summary
    eventBus.emit('data:trails-loaded', {
      featureCount: geojson.features.length,
      bbox
    });

    return geojson;
  }

  /**
   * Fetch land-use polygon data for a bounding box.
   * Returns parks, forests, water bodies, and other green/natural areas
   * as Polygon/MultiPolygon features for green space scoring.
   *
   * @param {number[]} bbox - Bounding box as [south, west, north, east]
   * @param {Object} [options={}] - Query options passed to buildLandUseQuery
   * @returns {Promise<Object>} GeoJSON FeatureCollection of Polygon/MultiPolygon features
   */
  async fetchLandUse(bbox, options = {}) {
    const cacheKey = `landuse:${bbox.join(',')}`;
    const LAND_USE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days -- land-use changes rarely

    // Check cache first
    const cached = await getCached('trails', cacheKey);
    if (cached) {
      eventBus.emit('data:cache-hit', { key: cacheKey });
      return cached;
    }

    // Build the land-use Overpass QL query
    const query = buildLandUseQuery(bbox, options);

    // Try primary endpoint, fall back to secondary
    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        throw new Error(`Overpass error: ${response.status}`);
      }
    } catch (primaryError) {
      // Try fallback endpoint
      response = await fetch(this.fallbackEndpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        throw new Error(`Overpass fallback error: ${response.status}`);
      }
    }

    // Parse, normalize to GeoJSON, then convert to polygons only
    const data = await response.json();
    const geojson = normalizeOverpassToGeoJSON(data);
    const polygons = normalizeToPolygons(geojson);

    // Cache the polygon-only result with 7-day TTL
    await setCache('trails', cacheKey, polygons, LAND_USE_TTL);

    // Emit event with results summary
    eventBus.emit('data:landuse-loaded', {
      featureCount: polygons.features.length,
      bbox
    });

    return polygons;
  }
}
