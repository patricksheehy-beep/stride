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
      elevation: true,
      instructions: true,
      instructions_format: 'text',
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

  /**
   * Generate a round-trip loop route from a single starting point.
   * Uses ORS round_trip parameter with seed variation for different loop shapes.
   * Returns GeoJSON FeatureCollection.
   *
   * IMPORTANT: round_trip and alternative_routes are mutually exclusive in ORS.
   * Use different seed values to generate multiple distinct loops.
   *
   * @param {{lat: number, lng: number}} startPoint - Loop start/end point
   * @param {object} [options={}] - Round trip options
   * @param {number} [options.length=5000] - Target distance in meters
   * @param {number} [options.points=5] - Number of waypoints for loop shape (more = more circular)
   * @param {number} [options.seed=0] - Randomization seed (different seed = different route)
   * @returns {Promise<object>} GeoJSON FeatureCollection
   */
  async roundTrip(startPoint, options = {}) {
    const { length = 5000, points = 5, seed = 0 } = options;

    const body = {
      coordinates: [[startPoint.lng, startPoint.lat]],
      preference: 'recommended',
      units: 'km',
      geometry: true,
      elevation: true,
      instructions: true,
      instructions_format: 'text',
      options: {
        round_trip: {
          length: length,
          points: points,
          seed: seed
        },
        profile_params: {
          weightings: {
            green: { factor: 1.0 },
            quiet: { factor: 1.0 }
          }
        }
      }
    };

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
      throw new Error(`ORS round trip error: ${response.status}`);
    }

    return response.json();
  }
}
