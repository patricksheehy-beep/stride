/**
 * Route continuity scoring factor.
 * Scores routes based on smoothness of direction changes.
 * Fewer sharp turns = higher continuity = better running experience.
 *
 * Uses @turf/bearing to compute bearing changes between consecutive
 * coordinate triplets. Turns exceeding 120 degrees are counted as "sharp."
 */
import { bearing } from '@turf/bearing';
import { point } from '@turf/helpers';

/**
 * Normalize a bearing difference to the range [0, 180].
 * Bearing values are in [-180, 180], so the absolute change
 * between two bearings can wrap around.
 *
 * @param {number} b1 - First bearing in degrees
 * @param {number} b2 - Second bearing in degrees
 * @returns {number} Absolute bearing change in [0, 180]
 */
function bearingChange(b1, b2) {
  let diff = Math.abs(b2 - b1);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Score a route's continuity based on direction smoothness.
 * Examines consecutive coordinate triplets and counts sharp turns
 * where the bearing change exceeds 120 degrees.
 *
 * Score = 1.0 - (sharpTurns / totalCoordinates), clamped to [0, 1].
 *
 * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection with LineString feature(s)
 * @returns {number} Score between 0 and 1 (1.0 = perfectly smooth)
 */
export function scoreContinuity(routeGeoJSON) {
  if (!routeGeoJSON.features || routeGeoJSON.features.length === 0) {
    return 1.0;
  }

  const route = routeGeoJSON.features[0];
  const coords = route.geometry.coordinates;

  // Need at least 3 coordinates to detect a turn
  if (coords.length < 3) {
    return 1.0;
  }

  let sharpTurns = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const bearingIn = bearing(point(coords[i - 1]), point(coords[i]));
    const bearingOut = bearing(point(coords[i]), point(coords[i + 1]));
    const change = bearingChange(bearingIn, bearingOut);

    if (change > 120) {
      sharpTurns++;
    }
  }

  // Score = 1.0 - (sharpTurns / totalCoordinates), clamped
  const turnPenalty = sharpTurns / coords.length;
  return Math.max(0, Math.min(1, 1.0 - turnPenalty));
}
