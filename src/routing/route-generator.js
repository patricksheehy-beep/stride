/**
 * RouteGenerator: Top-level pipeline orchestrating route generation, scoring, and ranking.
 *
 * Pipeline:
 *   1. Fetch trail data from Overpass
 *   2. Generate 3 candidates via waypoint-based trail forcing
 *   3. Score and rank candidates
 *   4. Generate descriptions (from ORS step data, no Claude required)
 *   5. Return ranked results
 */
import turfLength from '@turf/length';
import { eventBus } from '../core/event-bus.js';
import { store } from '../core/state.js';
import { getCached, setCache, ROUTE_STORE } from '../core/cache.js';
import { detectRegion } from '../data/region-profiles.js';
import { getWeightsForRegion, mergeWeights } from '../scoring/weights.js';
import { RouteScorer } from '../scoring/scorer.js';
import { analyzeDataQuality } from '../data/data-quality.js';

export class RouteGenerator {
  constructor({ routeBuilder, scorer, overpassAdapter, nlParser = null, routeExplainer = null }) {
    this.routeBuilder = routeBuilder;
    this.scorer = scorer;
    this.overpassAdapter = overpassAdapter;
    this.nlParser = nlParser;
    this.routeExplainer = routeExplainer;
  }

  _calculateBbox(startPoint, distanceKm) {
    const radius = (distanceKm / (2 * Math.PI)) * 1.5;
    const latOffset = radius / 111.32;
    const lngOffset = radius / (111.32 * Math.cos(startPoint.lat * Math.PI / 180));
    return [
      startPoint.lat - latOffset,
      startPoint.lng - lngOffset,
      startPoint.lat + latOffset,
      startPoint.lng + lngOffset
    ];
  }

  /**
   * Build a human-readable description from ORS route steps and trail data.
   * Works without Claude API — uses the actual route geometry and OSM data.
   */
  _buildDescription(routeGeoJSON, trailData, index, vibe) {
    const steps = routeGeoJSON?.features?.[0]?.properties?.segments?.[0]?.steps || [];
    const distKm = routeGeoJSON?.features?.[0]?.properties?.segments?.[0]?.distance;
    const distMi = distKm ? (distKm / 1609.34).toFixed(1) : '?';

    // Extract trail/street names from ORS steps
    const names = new Set();
    for (const step of steps) {
      if (step.instruction) {
        const m = step.instruction.match(/(?:onto|on|along)\s+(.+?)(?:\s+for|\s*$)/i);
        if (m) names.add(m[1].trim());
      }
    }

    // Extract OSM feature info from trail data for this route's area
    const trailTypes = new Set();
    const waterFeatures = [];
    const parkFeatures = [];
    if (trailData?.features) {
      for (const f of trailData.features) {
        const p = f.properties || {};
        if (p.highway) trailTypes.add(p.highway);
        if (p.natural === 'water' || p.waterway) waterFeatures.push(p.name || 'waterway');
        if (p.leisure === 'park' || p.landuse === 'forest') parkFeatures.push(p.name || 'park');
      }
    }

    const nameList = [...names].slice(0, 3);
    const nameStr = nameList.length > 0 ? nameList.join(', ') : 'local paths';

    // Vibe-specific descriptions
    if (vibe === 'nature') {
      const greenInfo = parkFeatures.length > 0 ? ` Near ${parkFeatures.slice(0, 2).join(' and ')}.` : '';
      const waterInfo = waterFeatures.length > 0 ? ` Passes near ${waterFeatures.slice(0, 1).join('')}.` : '';
      return `Nature route along ${nameStr}.${greenInfo}${waterInfo} Explores green spaces and trails in the area.`;
    }

    if (vibe === 'sightseeing') {
      return `Sightseeing route through ${nameStr}. Passes through interesting neighborhoods and points of interest in the area.`;
    }

    // General
    return `Route along ${nameStr}. A ${distMi} mi loop exploring the area with a mix of paths and streets.`;
  }

  async generate(startPoint, distanceKm, options = {}) {
    const routeType = options.routeType || 'loop';
    const activity = options.activity || 'run';
    const vibe = options.vibe || 'general';
    const cacheKey = `gen:${startPoint.lat.toFixed(4)},${startPoint.lng.toFixed(4)}:${distanceKm}:${routeType}:${activity}:${vibe}`;

    try {
      eventBus.emit('route:generation-started', { startPoint, distanceKm });
      store.isGenerating = true;

      // Check cache
      const cached = await getCached(ROUTE_STORE, cacheKey);
      if (cached) {
        store.currentRoute = cached.bestRoute;
        store.isGenerating = false;
        eventBus.emit('route:generation-complete', cached);
        return cached;
      }

      // Set activity on routing adapters
      if (this.routeBuilder.orsAdapter?.setActivity) this.routeBuilder.orsAdapter.setActivity(activity);
      if (this.routeBuilder.engineManager?.orsAdapter?.setActivity) this.routeBuilder.engineManager.orsAdapter.setActivity(activity);
      if (this.routeBuilder.engineManager?.osrmAdapter?.setActivity) this.routeBuilder.engineManager.osrmAdapter.setActivity(activity);

      // Detect region and get scoring weights
      const region = detectRegion(startPoint.lat, startPoint.lng);
      let finalWeights = getWeightsForRegion(region);

      // Adjust weights based on vibe
      if (vibe === 'nature') {
        finalWeights = mergeWeights(finalWeights, { greenSpace: 0.4, scenic: 0.3, trailPreference: 0.3 });
      } else if (vibe === 'sightseeing') {
        finalWeights = mergeWeights(finalWeights, { scenic: 0.4, continuity: 0.3 });
      }

      // Parse NL description if Claude available
      let nlResult = null;
      if (options.userDescription && this.nlParser) {
        try {
          nlResult = await this.nlParser.parse(options.userDescription);
          if (nlResult?.weights) {
            finalWeights = mergeWeights(finalWeights, nlResult.weights);
          }
        } catch {
          // NL parsing failed; continue with vibe weights
        }
      }

      const scorer = new RouteScorer(finalWeights);

      // Fetch trail data
      const bbox = this._calculateBbox(startPoint, distanceKm);
      let trailData;
      try {
        trailData = await this.overpassAdapter.fetchTrails(bbox);
      } catch (err) {
        throw new Error(`Could not fetch trail data: ${err.message}`);
      }
      store.trails = trailData;

      const dataQuality = analyzeDataQuality(trailData);
      eventBus.emit('route:data-quality', { region, dataQuality });

      // Fetch land-use data
      let landUseData = null;
      try {
        landUseData = await this.overpassAdapter.fetchLandUse(bbox);
      } catch {
        // Continue without land-use data
      }

      // Generate 3 candidates with different bearing offsets
      const candidates = [];
      const destination = options.destination || null;
      const bearingOffsets = routeType === 'point-to-point'
        ? [0, 45, -45]
        : routeType === 'out-and-back'
          ? [0, 90, 180]
          : [0, 30, 60];

      console.log(`Generating ${bearingOffsets.length} candidates (${routeType})...`);

      for (const offset of bearingOffsets) {
        try {
          const waypointResult = await this.routeBuilder.generateCandidateViaWaypoints(
            startPoint, trailData, distanceKm, { bearingOffset: offset, routeType, destination }
          );
          const waypointRoute = waypointResult.route || waypointResult;
          candidates.push({ route: waypointRoute, trailData, landUseData });
          console.log(`Candidate ${candidates.length} generated (bearing offset ${offset})`);
        } catch (err) {
          console.warn(`Candidate failed (offset ${offset}):`, err.message);
        }
      }

      if (candidates.length === 0) {
        const msg = dataQuality.density === 'sparse'
          ? `No routes found. Trail data is sparse here (${dataQuality.totalFeatures} features). Try a different location.`
          : 'No routes could be generated. Try adjusting the distance or location.';
        throw new Error(msg);
      }

      // Score and rank (main thread only — Web Worker serialization is unreliable)
      const rankedResults = scorer.scoreAndRank(candidates, startPoint);

      // Measure distances and build descriptions
      for (let i = 0; i < rankedResults.length; i++) {
        const result = rankedResults[i];
        try {
          const routeGeoJSON = result.route;
          if (routeGeoJSON?.features?.[0]) {
            result.distanceKm = turfLength(routeGeoJSON.features[0], { units: 'kilometers' });
          } else {
            result.distanceKm = 0;
          }
        } catch {
          result.distanceKm = 0;
        }

        // Build description from route data (no Claude needed)
        result.explanation = this._buildDescription(result.route, trailData, i, vibe);
      }

      // If Claude explainer available, enhance descriptions
      if (this.routeExplainer) {
        try {
          const routeDataForExplanation = rankedResults.slice(0, 3).map(result => ({
            distanceKm: result.distanceKm,
            score: result.score,
            ...this.routeExplainer._extractTrailMetadata(result.route, trailData, landUseData),
            vibeKeywords: nlResult?.vibeKeywords || [],
            vibe
          }));
          const explanations = await this.routeExplainer.explainBatch(routeDataForExplanation);
          for (let i = 0; i < explanations.length && i < rankedResults.length; i++) {
            rankedResults[i].explanation = explanations[i];
          }
        } catch {
          // Keep the built-in descriptions
        }
      }

      const generateResult = {
        routes: rankedResults,
        bestRoute: rankedResults[0],
        nlResult,
        dataQuality,
        vibe,
        activity
      };

      await setCache(ROUTE_STORE, cacheKey, generateResult);
      store.currentRoute = generateResult.bestRoute;
      store.isGenerating = false;
      eventBus.emit('route:generation-complete', generateResult);
      return generateResult;

    } catch (err) {
      store.isGenerating = false;
      console.error('Route generation failed:', err);
      eventBus.emit('route:generation-failed', { error: err.message });
      throw err;
    }
  }
}
