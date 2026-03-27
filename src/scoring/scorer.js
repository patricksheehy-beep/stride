/**
 * RouteScorer: Multi-factor scoring orchestrator.
 * Evaluates route quality across five dimensions using configurable weights.
 *
 * Scoring factors:
 *   1. Surface quality   -- from OSM surface tags
 *   2. Continuity        -- smoothness of direction changes
 *   3. Trail preference  -- highway type (trail vs road)
 *   4. Scenic value      -- water/green/named-trail proximity (feature counting)
 *   5. Green space       -- geometric route-through-polygon coverage
 *
 * Each factor returns a score in [0, 1]. The total score is a weighted
 * combination of all factors, also in [0, 1].
 */
import { scoreSurface } from './factors/surface.js';
import { scoreTrailPreference } from './factors/trail-preference.js';
import { scoreContinuity } from './factors/continuity.js';
import { scoreScenic } from './factors/scenic.js';
import { scoreGreenSpace } from './factors/green-space.js';
import { DEFAULT_WEIGHTS } from './weights.js';

export class RouteScorer {
  /**
   * Create a RouteScorer with the given weight profile.
   * @param {Object} [weights=DEFAULT_WEIGHTS] - Scoring weights
   * @param {number} weights.surface - Weight for surface quality factor
   * @param {number} weights.continuity - Weight for route continuity factor
   * @param {number} weights.trailPreference - Weight for trail preference factor
   * @param {number} weights.scenic - Weight for scenic value factor
   * @param {number} weights.greenSpace - Weight for green space coverage factor
   */
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Score a single route candidate.
   *
   * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection with LineString feature(s)
   * @param {Object} trailData - GeoJSON FeatureCollection of trail features with OSM properties
   * @param {number[]} startPoint - [lng, lat] starting coordinates
   * @param {Object|null} [landUseData=null] - GeoJSON FeatureCollection of Polygon/MultiPolygon
   *   features for green space scoring. When null/undefined, green space uses neutral 0.4 base.
   * @returns {{ total: number, breakdown: { surfaceScore: number, continuityScore: number, trailPrefScore: number, scenicScore: number, greenSpaceScore: number }}}
   */
  scoreRoute(routeGeoJSON, trailData, startPoint, landUseData = null) {
    const surfaceScore = scoreSurface(routeGeoJSON, trailData);
    const continuityScore = scoreContinuity(routeGeoJSON);
    const trailPrefScore = scoreTrailPreference(routeGeoJSON, trailData);
    const scenicScore = scoreScenic(routeGeoJSON, trailData);
    const greenSpaceScore = scoreGreenSpace(routeGeoJSON, landUseData);

    const total =
      this.weights.surface * surfaceScore +
      this.weights.continuity * continuityScore +
      this.weights.trailPreference * trailPrefScore +
      this.weights.scenic * scenicScore +
      this.weights.greenSpace * greenSpaceScore;

    return {
      total,
      breakdown: {
        surfaceScore,
        continuityScore,
        trailPrefScore,
        scenicScore,
        greenSpaceScore
      }
    };
  }

  /**
   * Score and rank multiple route candidates.
   * Returns candidates sorted by total score descending (best first).
   *
   * @param {Array<{ route: Object, trailData: Object }>} candidates - Array of { route, trailData } objects
   * @param {number[]} startPoint - [lng, lat] starting coordinates
   * @returns {Array<{ route: Object, score: { total: number, breakdown: Object }}>} Sorted by total descending
   */
  scoreAndRank(candidates, startPoint) {
    const scored = candidates.map(({ route, trailData, landUseData }) => ({
      route,
      score: this.scoreRoute(route, trailData, startPoint, landUseData || null)
    }));

    // Sort by total score descending (best route first)
    scored.sort((a, b) => b.score.total - a.score.total);

    return scored;
  }
}
