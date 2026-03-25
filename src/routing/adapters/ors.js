/**
 * ORS (OpenRouteService) routing adapter for foot-hiking profile.
 * Sends requests to the ORS Directions API with green/quiet trail preferences.
 * ORS returns GeoJSON natively, so no normalization is needed.
 */
import { config } from '../../core/config.js';

export class ORSAdapter {
  /**
   * @param {string} apiKey - ORS API key
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = config.orsBaseUrl;
  }

  /**
   * Build the JSON request body for ORS Directions API.
   * Converts waypoints from {lat, lng} to [lng, lat] order required by ORS.
   *
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {object} ORS request body
   */
  buildRequestBody(waypoints) {
    return {
      coordinates: waypoints.map(p => [p.lng, p.lat]),
      preference: 'recommended',
      units: 'km',
      geometry: true,
      instructions: false,
      options: {
        profile_params: {
          weightings: {
            green: { factor: 1.0 },
            quiet: { factor: 1.0 }
          }
        }
      }
    };
  }

  /**
   * Route between waypoints using ORS foot-hiking profile.
   * Returns GeoJSON FeatureCollection (ORS native format).
   * Throws on rate limit (429) or other HTTP errors.
   *
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {Promise<object>} GeoJSON FeatureCollection
   */
  async route(waypoints) {
    const body = this.buildRequestBody(waypoints);
    const response = await fetch(
      `${this.baseUrl}/v2/directions/foot-hiking/geojson`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (response.status === 429) {
      throw new Error('ORS rate limit exceeded');
    }
    if (!response.ok) {
      throw new Error(`ORS error: ${response.status}`);
    }

    return response.json();
  }
}
