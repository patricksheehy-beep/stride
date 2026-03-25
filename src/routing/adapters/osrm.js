/**
 * OSRM (Open Source Routing Machine) adapter for fallback routing.
 * Uses the public OSRM demo server with the foot profile.
 * Normalizes OSRM responses to GeoJSON FeatureCollection format.
 */
import { config } from '../../core/config.js';

/**
 * Normalize an OSRM response to a GeoJSON FeatureCollection.
 * Converts distance from meters to kilometers and tags engine as 'osrm'.
 *
 * @param {object} data - Raw OSRM response
 * @returns {object} GeoJSON FeatureCollection
 */
export function normalizeOSRMResponse(data) {
  return {
    type: 'FeatureCollection',
    features: data.routes.map(route => ({
      type: 'Feature',
      geometry: route.geometry,
      properties: {
        distance: route.distance / 1000,
        duration: route.duration,
        engine: 'osrm'
      }
    }))
  };
}

export class OSRMAdapter {
  constructor() {
    this.baseUrl = config.osrmBaseUrl;
  }

  /**
   * Build the OSRM request URL for foot routing.
   * Coordinates are formatted as lng,lat pairs separated by semicolons.
   *
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {string} OSRM request URL
   */
  buildUrl(waypoints) {
    const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
    return `${this.baseUrl}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;
  }

  /**
   * Route between waypoints using OSRM foot profile.
   * Returns normalized GeoJSON FeatureCollection.
   *
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {Promise<object>} GeoJSON FeatureCollection
   */
  async route(waypoints) {
    const url = this.buildUrl(waypoints);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(`OSRM routing failed: ${data.code}`);
    }

    return normalizeOSRMResponse(data);
  }
}
