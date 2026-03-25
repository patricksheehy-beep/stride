/**
 * Overpass API adapter with GeoJSON normalization and cache integration.
 * Fetches trail data using comprehensive queries, normalizes responses
 * to standard GeoJSON FeatureCollection, and caches results in IndexedDB.
 */
import { buildTrailQuery } from '../query-builder.js';
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
}
