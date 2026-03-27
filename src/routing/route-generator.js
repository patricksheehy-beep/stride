/**
 * RouteGenerator: Top-level pipeline orchestrating route generation, scoring, and ranking.
 *
 * Combines two candidate generation strategies:
 * 1. ORS round_trip with seed variation (quick, 1 API call per candidate)
 * 2. Waypoint-based trail forcing (snaps to trail geometry for higher trail preference)
 *
 * Pipeline:
 *   1. Emit 'route:generation-started'
 *   2. Check cache
 *   3. Detect region, fetch trail data
 *   4. Generate candidates via both strategies
 *   5. Score and rank all candidates
 *   6. Measure distances, cache result
 *   7. Update app state, emit 'route:generation-complete'
 */
import turfLength from '@turf/length';
import { eventBus } from '../core/event-bus.js';
import { store } from '../core/state.js';
import { getCached, setCache, ROUTE_STORE } from '../core/cache.js';
import { detectRegion } from '../data/region-profiles.js';
import { getWeightsForRegion, mergeWeights } from '../scoring/weights.js';
import { RouteScorer } from '../scoring/scorer.js';

export class RouteGenerator {
  /**
   * @param {object} deps - Dependencies
   * @param {object} deps.routeBuilder - RouteBuilder instance for candidate generation
   * @param {object} deps.scorer - RouteScorer instance for scoring and ranking
   * @param {object} deps.overpassAdapter - OverpassAdapter for fetching trail data
   * @param {object|null} [deps.nlParser=null] - NLParser instance for user description parsing
   * @param {object|null} [deps.routeExplainer=null] - RouteExplainer instance for explanation generation
   */
  constructor({ routeBuilder, scorer, overpassAdapter, nlParser = null, routeExplainer = null }) {
    this.routeBuilder = routeBuilder;
    this.scorer = scorer;
    this.overpassAdapter = overpassAdapter;
    this.nlParser = nlParser;
    this.routeExplainer = routeExplainer;
  }

  /**
   * Calculate a bounding box centered on startPoint large enough for a loop
   * of the requested distance.
   *
   * @param {{lat: number, lng: number}} startPoint - Center point
   * @param {number} distanceKm - Target loop distance in kilometers
   * @returns {number[]} Bounding box as [south, west, north, east]
   */
  _calculateBbox(startPoint, distanceKm) {
    // Radius of a circle with circumference = distanceKm, plus 50% buffer
    const radius = (distanceKm / (2 * Math.PI)) * 1.5;
    const latOffset = radius / 111.32;
    const lngOffset = radius / (111.32 * Math.cos(startPoint.lat * Math.PI / 180));

    return [
      startPoint.lat - latOffset,  // south
      startPoint.lng - lngOffset,  // west
      startPoint.lat + latOffset,  // north
      startPoint.lng + lngOffset   // east
    ];
  }

  /**
   * Generate, score, and rank route candidates.
   *
   * @param {{lat: number, lng: number}} startPoint - Starting/ending point for loop routes
   * @param {number} distanceKm - Target distance in kilometers
   * @param {object} [options={}] - Generation options
   * @returns {Promise<{routes: Array, bestRoute: object}>} Ranked routes with best route
   * @throws {Error} When no candidates can be generated
   */
  async generate(startPoint, distanceKm, options = {}) {
    const cacheKey = `generated:${startPoint.lat},${startPoint.lng}:${distanceKm}`;

    try {
      // 1. Emit start event and set generating state
      eventBus.emit('route:generation-started', { startPoint, distanceKm });
      store.isGenerating = true;

      // 2. Check cache
      const cached = await getCached(ROUTE_STORE, cacheKey);
      if (cached) {
        store.currentRoute = cached.bestRoute;
        store.isGenerating = false;
        eventBus.emit('route:generation-complete', cached);
        return cached;
      }

      // 3. Detect region and get appropriate scoring weights
      const region = detectRegion(startPoint.lat, startPoint.lng);
      const weights = getWeightsForRegion(region);

      // 3b. Parse NL description if provided
      let nlResult = null;
      let finalWeights = weights;
      if (options.userDescription && this.nlParser) {
        try {
          nlResult = await this.nlParser.parse(options.userDescription);
          if (nlResult?.weights) {
            finalWeights = mergeWeights(weights, nlResult.weights);
          }
        } catch {
          // NL parsing failed; continue with region defaults
        }
      }
      const scorer = new RouteScorer(finalWeights);

      // 4. Calculate bbox and fetch trail data
      const bbox = this._calculateBbox(startPoint, distanceKm);
      const trailData = await this.overpassAdapter.fetchTrails(bbox);
      store.trails = trailData;

      // 4b. Fetch land-use data for green space scoring
      let landUseData = null;
      try {
        landUseData = await this.overpassAdapter.fetchLandUse(bbox);
      } catch {
        // Land-use fetch failed; green space scoring will use neutral base
      }

      // 5. Generate candidates via both strategies
      const candidates = [];

      // 5a. Round trip candidates
      try {
        const roundTripCandidates = await this.routeBuilder.generateCandidatesViaRoundTrip(
          startPoint, distanceKm, 3
        );
        for (const candidate of roundTripCandidates) {
          candidates.push({ route: candidate, trailData, landUseData });
        }
      } catch {
        // Round trip generation failed; continue with waypoint strategy
      }

      // 5b. Waypoint-based candidate
      try {
        const waypointResult = await this.routeBuilder.generateCandidateViaWaypoints(
          startPoint, trailData, distanceKm
        );
        // waypointResult is { route, engine } from EngineManager
        const waypointRoute = waypointResult.route || waypointResult;
        candidates.push({ route: waypointRoute, trailData, landUseData });
      } catch {
        // Waypoint generation failed; continue with what we have
      }

      // 6. If no candidates at all, throw
      if (candidates.length === 0) {
        throw new Error('No route candidates could be generated');
      }

      // 7. Score and rank all candidates
      const rankedResults = scorer.scoreAndRank(candidates, startPoint);

      // 8. Add distanceKm measurement to each result
      for (const result of rankedResults) {
        try {
          const routeGeoJSON = result.route;
          if (routeGeoJSON && routeGeoJSON.features && routeGeoJSON.features.length > 0) {
            result.distanceKm = turfLength(routeGeoJSON.features[0], { units: 'kilometers' });
          } else {
            result.distanceKm = 0;
          }
        } catch {
          result.distanceKm = 0;
        }
      }

      // 8b. Generate explanations for top routes
      if (this.routeExplainer) {
        try {
          const routeDataForExplanation = rankedResults.slice(0, 3).map(result => ({
            distanceKm: result.distanceKm,
            score: result.score,
            ...this.routeExplainer._extractTrailMetadata(result.route, trailData, landUseData),
            vibeKeywords: nlResult?.vibeKeywords || []
          }));
          const explanations = await this.routeExplainer.explainBatch(routeDataForExplanation);
          for (let i = 0; i < explanations.length && i < rankedResults.length; i++) {
            rankedResults[i].explanation = explanations[i];
          }
        } catch {
          // Explanation generation failed; routes still usable without explanations
        }
      }

      // 9. Build result
      const generateResult = {
        routes: rankedResults,
        bestRoute: rankedResults[0],
        nlResult
      };

      // 10. Cache result
      await setCache(ROUTE_STORE, cacheKey, generateResult);

      // 11. Update state
      store.currentRoute = generateResult.bestRoute;
      store.isGenerating = false;

      // 12. Emit completion event
      eventBus.emit('route:generation-complete', generateResult);

      return generateResult;

    } catch (err) {
      // On error: clean up state and emit failure
      store.isGenerating = false;
      eventBus.emit('route:generation-failed', { error: err.message });
      throw err;
    }
  }
}
