/**
 * RouteBuilder: Orchestrates loop route generation and distance refinement.
 *
 * Generates loop route candidates using two strategies:
 * 1. ORS round_trip with seed variation (quick, single API call per candidate)
 * 2. Waypoint-based trail forcing (places waypoints on trail geometry, routes between them)
 *
 * Distance refinement iterates up to 3 times to hit 10% accuracy target.
 * Waypoints are snapped to actual trail geometry using @turf/nearest-point-on-line.
 */
import turfLength from '@turf/length';
import turfDestination from '@turf/destination';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { point } from '@turf/helpers';
import { eventBus } from '../core/event-bus.js';

export class RouteBuilder {
  /**
   * @param {object} deps - Dependencies
   * @param {object} deps.orsAdapter - ORS adapter with roundTrip method
   * @param {object} deps.engineManager - Engine manager with route method
   * @param {object} deps.scorer - RouteScorer instance
   */
  constructor({ orsAdapter, engineManager, scorer }) {
    this.orsAdapter = orsAdapter;
    this.engineManager = engineManager;
    this.scorer = scorer;
  }

  /**
   * Generate multiple loop candidates using ORS round_trip with different seeds.
   * Generates count+2 attempts and returns up to count successful results.
   *
   * @param {{lat: number, lng: number}} startPoint - Loop start/end point
   * @param {number} distanceKm - Target distance in kilometers
   * @param {number} [count=3] - Number of candidates to return
   * @returns {Promise<Array<object>>} Array of GeoJSON FeatureCollections
   */
  async generateCandidatesViaRoundTrip(startPoint, distanceKm, count = 3) {
    eventBus.emit('route:candidates-generating', { startPoint, distanceKm, count });

    const candidates = [];
    const totalAttempts = count + 2;

    for (let seed = 0; seed < totalAttempts; seed++) {
      try {
        const result = await this.orsAdapter.roundTrip(startPoint, {
          length: distanceKm * 1000, // ORS expects meters
          points: 5,
          seed: seed
        });

        if (result && result.features?.length > 0) {
          candidates.push(result);

          const actualKm = turfLength(result.features[0], { units: 'kilometers' });
          eventBus.emit('route:candidate-generated', {
            index: candidates.length - 1,
            distanceKm: actualKm
          });
        }
      } catch (err) {
        // Some seeds may fail; continue with others
        // This is expected behavior, not an error
      }

      // Return early if we have enough candidates
      if (candidates.length >= count) {
        break;
      }
    }

    return candidates.slice(0, count);
  }

  /**
   * Place 4 waypoints at roughly equal angular spacing around the start point,
   * snapped to the nearest trail geometry.
   *
   * Uses @turf/destination for geometric placement and @turf/nearest-point-on-line
   * for snapping to actual trail geometry.
   *
   * @param {{lat: number, lng: number}} startPoint - Center point
   * @param {object} trails - GeoJSON FeatureCollection of trail features
   * @param {number} targetDistanceKm - Target loop distance in kilometers
   * @returns {Array<{lat: number, lng: number}>} Array of 4 snapped waypoints
   */
  buildLoopWaypoints(startPoint, trails, targetDistanceKm, { bearingOffset = 0 } = {}) {
    const radius = targetDistanceKm / (2 * Math.PI);
    const numPoints = 4;
    const bearings = [0 + bearingOffset, 90 + bearingOffset, 180 + bearingOffset, 270 + bearingOffset];
    const waypoints = [];

    const startTurfPoint = point([startPoint.lng, startPoint.lat]);

    for (let i = 0; i < numPoints; i++) {
      // Place candidate at bearing and radius from start
      const candidate = turfDestination(startTurfPoint, radius, bearings[i], { units: 'kilometers' });

      // Snap to nearest trail geometry
      const snapped = this._snapToNearestTrail(candidate, trails);
      waypoints.push(snapped);
    }

    return waypoints;
  }

  /**
   * Snap a point to the nearest trail feature using @turf/nearest-point-on-line.
   *
   * @param {object} turfPoint - Turf.js point feature
   * @param {object} trails - GeoJSON FeatureCollection of trail features
   * @returns {{lat: number, lng: number}} Snapped point coordinates
   * @private
   */
  _snapToNearestTrail(turfPoint, trails) {
    let bestSnapped = null;
    let bestDistance = Infinity;

    for (const feature of trails.features) {
      if (feature.geometry.type !== 'LineString') {
        continue;
      }
      try {
        const snapped = nearestPointOnLine(feature, turfPoint, { units: 'kilometers' });
        const dist = snapped.properties.dist;
        if (dist < bestDistance) {
          bestDistance = dist;
          bestSnapped = snapped;
        }
      } catch {
        // Skip features that can't be processed
      }
    }

    if (bestSnapped) {
      return {
        lat: bestSnapped.geometry.coordinates[1],
        lng: bestSnapped.geometry.coordinates[0]
      };
    }

    // Fallback: use raw geometric position if no trails found
    return {
      lat: turfPoint.geometry.coordinates[1],
      lng: turfPoint.geometry.coordinates[0]
    };
  }

  /**
   * Generate a single loop candidate using waypoint-based trail forcing.
   * Places 4 waypoints around start, snapped to trails, and routes between them.
   *
   * @param {{lat: number, lng: number}} startPoint - Loop start/end point
   * @param {object} trailData - GeoJSON FeatureCollection of trail features
   * @param {number} distanceKm - Target distance in kilometers
   * @returns {Promise<{route: object, engine: string}>} Routing result
   */
  /**
   * Generate a route candidate using waypoint-based trail forcing with distance refinement.
   */
  async generateCandidateViaWaypoints(startPoint, trailData, distanceKm, { bearingOffset = 0, routeType = 'loop', destination = null } = {}) {
    if (routeType === 'out-and-back') {
      return this._generateOutAndBack(startPoint, trailData, distanceKm, { bearingOffset });
    }
    if (routeType === 'point-to-point' && destination) {
      return this._generatePointToPoint(startPoint, destination, trailData, { bearingOffset });
    }

    let adjustedDistance = distanceKm;
    let bestResult = null;
    let bestError = Infinity;

    for (let iteration = 0; iteration < 3; iteration++) {
      const waypoints = this.buildLoopWaypoints(startPoint, trailData, adjustedDistance, { bearingOffset });
      const fullWaypoints = [startPoint, ...waypoints, startPoint];

      const result = await this.engineManager.route(fullWaypoints);
      const routeGeoJSON = result.route || result;

      const feature = routeGeoJSON.features?.[0] || routeGeoJSON;
      const actualKm = turfLength(feature, { units: 'kilometers' });
      const error = Math.abs(actualKm - distanceKm) / distanceKm;

      if (error < bestError) {
        bestError = error;
        bestResult = result;
      }

      if (error <= 0.10) {
        return result;
      }

      const ratio = distanceKm / actualKm;
      adjustedDistance = adjustedDistance * ratio;
    }

    return bestResult;
  }

  /**
   * Generate an out-and-back route: run out along a trail to the halfway point, then return.
   * Routes to a single far waypoint on a trail, then back to start on the same path.
   */
  async _generateOutAndBack(startPoint, trailData, distanceKm, { bearingOffset = 0 }) {
    const halfDistanceKm = distanceKm / 2;
    let adjustedHalf = halfDistanceKm;
    let bestResult = null;
    let bestError = Infinity;

    for (let iteration = 0; iteration < 3; iteration++) {
      // Place a single waypoint at the target half-distance along the best bearing
      const bearing = bearingOffset; // Single direction
      const startTurfPoint = point([startPoint.lng, startPoint.lat]);
      const farPoint = turfDestination(startTurfPoint, adjustedHalf, bearing, { units: 'kilometers' });
      const snapped = this._snapToNearestTrail(farPoint, trailData);

      // Route: start → far waypoint → start (same path back)
      const fullWaypoints = [startPoint, snapped, startPoint];
      const result = await this.engineManager.route(fullWaypoints);
      const routeGeoJSON = result.route || result;

      const feature = routeGeoJSON.features?.[0] || routeGeoJSON;
      const actualKm = turfLength(feature, { units: 'kilometers' });
      const error = Math.abs(actualKm - distanceKm) / distanceKm;

      if (error < bestError) {
        bestError = error;
        bestResult = result;
      }

      if (error <= 0.10) {
        return result;
      }

      const ratio = halfDistanceKm / (actualKm / 2);
      adjustedHalf = adjustedHalf * ratio;
    }

    return bestResult;
  }

  /**
   * Generate a point-to-point route from start to destination via trail waypoints.
   * Places intermediate waypoints between start and destination, snapped to trails.
   */
  async _generatePointToPoint(startPoint, destination, trailData, { bearingOffset = 0 }) {
    // Place 2 intermediate waypoints between start and destination, offset to find trails
    const midLat = (startPoint.lat + destination.lat) / 2;
    const midLng = (startPoint.lng + destination.lng) / 2;
    const midPoint = point([midLng, midLat]);

    // Offset the midpoint perpendicular to the direct line to explore different trail paths
    const directBearing = this._bearing(startPoint, destination);
    const perpBearing = directBearing + 90 + bearingOffset;
    const totalDistKm = this._haversineKm(startPoint, destination);
    const offsetDist = Math.max(0.3, totalDistKm * 0.15); // 15% of direct distance, min 300m

    const offsetPoint = turfDestination(midPoint, offsetDist, perpBearing, { units: 'kilometers' });
    const snapped = this._snapToNearestTrail(offsetPoint, trailData);

    const fullWaypoints = [startPoint, snapped, destination];
    const result = await this.engineManager.route(fullWaypoints);
    return result;
  }

  /**
   * Calculate bearing from point A to point B in degrees.
   */
  _bearing(a, b) {
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /**
   * Haversine distance in km between two points.
   */
  _haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /**
   * Iteratively refine route distance to hit the 10% accuracy target.
   * Generates a route, measures actual distance, adjusts target proportionally,
   * and regenerates. Returns the first candidate within 10% or the best found.
   *
   * @param {{lat: number, lng: number}} startPoint - Loop start/end point
   * @param {number} targetKm - Desired distance in kilometers
   * @param {number} [maxIterations=3] - Maximum refinement iterations
   * @returns {Promise<object|null>} Best GeoJSON FeatureCollection found
   */
  async refineDistance(startPoint, targetKm, maxIterations = 3) {
    let adjustedTarget = targetKm;
    let bestCandidate = null;
    let bestError = Infinity;

    for (let i = 0; i < maxIterations; i++) {
      const candidates = await this.generateCandidatesViaRoundTrip(
        startPoint,
        adjustedTarget,
        1
      );

      if (!candidates.length) {
        break;
      }

      const candidate = candidates[0];
      const actualKm = turfLength(candidate.features[0], { units: 'kilometers' });
      const error = Math.abs(actualKm - targetKm) / targetKm;

      // Track the best candidate (closest to target)
      if (error < bestError) {
        bestError = error;
        bestCandidate = candidate;
      }

      if (error <= 0.10) {
        // Within 10% tolerance
        return candidate;
      }

      // Adjust target proportionally: if route was too long, reduce; if too short, increase
      const ratio = targetKm / actualKm;
      adjustedTarget = adjustedTarget * ratio;
    }

    return bestCandidate;
  }
}
