/**
 * Trail preference scoring factor.
 * Scores route trail data based on OSM highway type tags.
 * Higher scores = more trail-like (path, footway) vs road-like (residential, tertiary).
 *
 * This is the core factor that addresses ROUTE-04: preferring trails over roads.
 * Missing highway tags default to 0.3 (neutral-low) since untagged ways
 * are more likely minor roads than dedicated trails.
 */
import { length } from '@turf/length';

/**
 * OSM highway tag values mapped to trail preference scores (0-1).
 * Higher = more desirable for running/hiking routes.
 */
export const HIGHWAY_PREFERENCE = {
  path: 1.0,              // Best: dedicated trail
  footway: 0.90,          // Designated pedestrian way
  track: 0.85,            // Farm/forest track
  bridleway: 0.80,        // UK-style bridleway
  cycleway: 0.70,         // Shared-use path
  pedestrian: 0.65,       // Pedestrian zone
  steps: 0.40,            // Stairs (necessary evil)
  living_street: 0.35,    // Residential shared space
  residential: 0.20,      // Regular street
  unclassified: 0.15,     // Minor road
  service: 0.10,          // Service road
  tertiary: 0.05          // Major road -- avoid
};

/** Default score for unknown/missing highway tags */
const DEFAULT_HIGHWAY_SCORE = 0.3;

/**
 * Score a route's trail preference based on trail data highway types.
 * Iterates trail features, looks up highway preference scores, and computes
 * a length-weighted average.
 *
 * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection (unused for now, reserved for future matching)
 * @param {Object} trailData - GeoJSON FeatureCollection of trail features with highway properties
 * @returns {number} Score between 0 and 1 (0.3 if no data)
 */
export function scoreTrailPreference(routeGeoJSON, trailData) {
  if (!trailData.features || trailData.features.length === 0) {
    return DEFAULT_HIGHWAY_SCORE;
  }

  let totalScore = 0;
  let totalLength = 0;

  for (const feature of trailData.features) {
    const highway = feature.properties.highway;
    const segLength = length(feature, { units: 'kilometers' });
    const score = highway && HIGHWAY_PREFERENCE[highway] !== undefined
      ? HIGHWAY_PREFERENCE[highway]
      : DEFAULT_HIGHWAY_SCORE;
    totalScore += score * segLength;
    totalLength += segLength;
  }

  return totalLength > 0 ? totalScore / totalLength : DEFAULT_HIGHWAY_SCORE;
}
