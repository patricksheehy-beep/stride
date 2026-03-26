/**
 * Surface quality scoring factor.
 * Scores route trail data based on OSM surface tags.
 * Higher scores = better running surfaces.
 *
 * Missing surface tags score as 0.5 (neutral) to handle OSM data gaps
 * gracefully -- not penalizing routes in regions with sparse tagging.
 */
import { length } from '@turf/length';

/**
 * OSM surface tag values mapped to running quality scores (0-1).
 * Values calibrated from Trail Router research and runner preference data.
 */
export const SURFACE_SCORES = {
  // Excellent running surfaces
  tartan: 1.0,            // Athletic track surface
  fine_gravel: 0.95,      // Packed gravel trail
  compacted: 0.90,        // Compacted earth
  asphalt: 0.85,          // Paved (good but less scenic)
  concrete: 0.80,         // Paved
  paving_stones: 0.75,    // Cobblestone-like

  // Good running surfaces
  gravel: 0.70,
  ground: 0.65,
  dirt: 0.65,
  earth: 0.60,
  grass: 0.55,
  woodchips: 0.50,

  // Poor running surfaces
  sand: 0.30,
  mud: 0.15,
  snow: 0.10,
  ice: 0.05,

  // Unknown -- treat as neutral (not zero)
  unknown: 0.50
};

/**
 * Score a route's surface quality based on trail data.
 * Iterates trail features, looks up surface scores, and computes
 * a length-weighted average.
 *
 * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection (unused for now, reserved for future matching)
 * @param {Object} trailData - GeoJSON FeatureCollection of trail features with surface properties
 * @returns {number} Score between 0 and 1 (0.5 if no data)
 */
export function scoreSurface(routeGeoJSON, trailData) {
  if (!trailData.features || trailData.features.length === 0) {
    return 0.5; // Neutral when no data available
  }

  let totalScore = 0;
  let totalLength = 0;

  for (const feature of trailData.features) {
    const surface = feature.properties.surface || 'unknown';
    const segLength = length(feature, { units: 'kilometers' });
    const score = SURFACE_SCORES[surface] ?? SURFACE_SCORES.unknown;
    totalScore += score * segLength;
    totalLength += segLength;
  }

  return totalLength > 0 ? totalScore / totalLength : 0.5;
}
