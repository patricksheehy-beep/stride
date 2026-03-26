# Phase 2: Route Building and Scoring Engine - Research

**Researched:** 2026-03-25
**Domain:** Loop route generation algorithms, multi-factor trail scoring, distance refinement, ORS/OSRM round-trip routing
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 transforms Stride from "we can find trails and route between two points" into "we can generate multiple high-quality loop routes at a requested distance, ranked by trail quality." This is the core algorithmic phase -- everything upstream (data, adapters, cache) exists from Phase 1, and everything downstream (NL input, export, PWA) depends on route generation working well.

The central technical challenge is generating circular loop routes that (a) return to the starting point, (b) match a requested distance within 10%, (c) prefer trails over roads, and (d) produce multiple distinct candidates ranked by a multi-factor quality score. Two viable approaches exist: using ORS's built-in `round_trip` API parameter (simpler, single API call, but less control over trail preference), or building a custom waypoint-based loop generator that places waypoints on scored trail segments and routes between them (more complex, multiple API calls, but maximum trail forcing). The recommended approach is a hybrid: use ORS `round_trip` with varying seeds to generate base loop candidates quickly, then enhance with a custom waypoint-based approach that forces routes through top-scored trail segments. This gives 3+ candidates with minimal API calls while maximizing trail preference.

The scoring engine is the quality differentiator. A multi-factor formula incorporating surface quality, trail continuity, scenic value (water/green proximity from OSM land-use tags), and route variety will rank candidates. Trail Router's proven approach -- computing a "green index" via 30m buffer intersection with park/forest/water polygons -- is the gold standard, but the full green-space polygon query approach is deferred to Phase 3 (DATA-04). For Phase 2, scoring uses the OSM tags already available from Overpass (surface, highway type, trail names, route relations) plus basic proximity heuristics for water and green features. This is sufficient to differentiate trail-heavy routes from road-heavy ones.

**Primary recommendation:** Build a RouteBuilder that generates 3+ loop candidates using ORS round_trip with multiple seeds combined with waypoint-based trail forcing, score each with a configurable multi-factor formula using OSM tag data from Phase 1, and rank by composite score. Implement iterative distance refinement to hit the 10% accuracy target.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | User can generate loop routes (not just out-and-back) for a requested distance | ORS `round_trip` API parameter generates circular routes from a single point. Custom waypoint-based approach with start=end also produces loops. Both documented below. |
| ROUTE-02 | Generated route distance matches requested distance within 10% accuracy | ORS `round_trip.length` parameter targets a distance. Iterative refinement (generate, measure, adjust, re-route) with circuity factors brings accuracy to <10%. Trail Router filters candidates at 50-200% of target. |
| ROUTE-03 | User receives 3+ route options ranked by quality for each request | ORS `round_trip.seed` parameter generates different routes per seed value. `alternative_routes.target_count` returns up to 3 alternatives for point-to-point. Combine seeds + waypoint variation for 3+ candidates. |
| ROUTE-04 | Routes are surface/terrain-aware -- preferring trails, paths, and unpaved surfaces when available | ORS `foot-hiking` profile with `green` and `quiet` weightings (already configured in Phase 1 ORS adapter). Waypoint-based trail forcing places route points ON trail segments. Scoring penalizes road-heavy routes. |
| ROUTE-07 | Multi-factor trail scoring ranks routes by green space proximity, water features, surface quality, trail continuity, and scenic value | Scoring factors documented: surface quality from OSM `surface` tag, continuity from connected segment length ratio, scenic value from proximity to `natural=water`/`leisure=park` features, trail classification from `highway` type. Full green-space polygon scoring deferred to Phase 3 (DATA-04). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** All code changes must go through GSD commands (`/gsd:execute-phase`, `/gsd:quick`, `/gsd:debug`). Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
- **No backend:** PWA runs entirely client-side. API keys stored in localStorage. No server-side components.
- **No frontend framework:** Vanilla JS + ES Modules + Vite. No React, Vue, or Svelte.
- **Modular architecture:** One responsibility per module. Use EventBus for cross-module communication. Adapter pattern for external APIs.
- **Vitest for testing:** All tests use Vitest with jsdom environment and fake-indexeddb.
- **Commit docs:** `commit_docs: true` in config.json.

## Standard Stack

### Core (Already Installed -- Phase 1)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Leaflet | 1.9.4 | Map rendering, route display | Installed |
| idb | 8.0.3 | IndexedDB wrapper for caching | Installed |
| @turf/helpers | 7.3.4 | GeoJSON feature constructors | Installed |
| @turf/distance | 7.3.4 | Point-to-point distance | Installed |
| @turf/bbox | 7.3.4 | Bounding box calculation | Installed |
| @mapbox/polyline | 1.2.1 | Polyline encoding/decoding | Installed |

### New Packages Required for Phase 2
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @turf/bearing | 7.3.4 | Calculate angle between points | Waypoint placement around loop perimeter |
| @turf/destination | 7.3.4 | Calculate point at distance+bearing | Generate candidate waypoints at target distance from start |
| @turf/length | 7.3.4 | Measure LineString distance | Calculate actual route distance from routed geometry |
| @turf/along | 7.3.4 | Point at distance along a line | Sample points along trail segments for waypoint placement |
| @turf/boolean-point-in-polygon | 7.3.4 | Check if point is inside polygon | Detect proximity to parks/green spaces from Overpass land-use data |
| @turf/nearest-point-on-line | 7.3.4 | Snap point to nearest line | Snap waypoints to actual trail geometry |
| @turf/center | 7.3.4 | Calculate centroid | Find center of trail cluster for loop planning |

**Version verification:** All @turf/* packages confirmed at 7.3.4 via npm registry (2026-03-25).

### Installation
```bash
npm install @turf/bearing@^7.3.4 @turf/destination@^7.3.4 @turf/length@^7.3.4 @turf/along@^7.3.4 @turf/boolean-point-in-polygon@^7.3.4 @turf/nearest-point-on-line@^7.3.4 @turf/center@^7.3.4
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom loop generator | ORS `round_trip` only | Simpler (1 API call) but no trail forcing -- routes follow ORS road bias |
| Waypoint-based forcing only | ORS `round_trip` + seeds | Custom gives max trail control but costs 3-10 API calls per candidate vs 1 |
| Full @turf/turf bundle | Individual @turf/* packages | 300KB bundle vs ~30KB cherry-picked. Do NOT install full bundle. |

## Architecture Patterns

### Recommended Project Structure (New Files for Phase 2)
```
src/
  routing/
    route-builder.js         # NEW: Orchestrates loop generation, candidate creation, ranking
    engine-manager.js         # EXISTS: ORS/OSRM fallback chain (Phase 1)
    adapters/
      ors.js                  # EXISTS: Needs round_trip + alternative_routes support added
      osrm.js                 # EXISTS: No changes needed
  scoring/
    scorer.js                 # NEW: Multi-factor scoring orchestrator
    factors/
      surface.js              # NEW: Surface quality scoring from OSM surface tags
      continuity.js           # NEW: Trail continuity scoring (connected segment ratio)
      trail-preference.js     # NEW: Highway type preference (trail > road)
      scenic.js               # NEW: Proximity to water/green features
    weights.js                # NEW: Configurable scoring weight profiles per region/mode
  data/
    query-builder.js          # EXISTS: May need land-use query extension
    adapters/overpass.js      # EXISTS: No changes needed
    region-profiles.js        # EXISTS: Scoring weights added per region
```

### Pattern 1: Loop Route Generation via ORS Round Trip + Seed Variation
**What:** Use ORS `round_trip` parameter with different `seed` values to generate multiple distinct loop candidates from a single starting point.
**When:** Primary loop generation strategy. Each seed produces a different loop shape.
**Why:** ORS does the heavy lifting of creating closed loops that follow the road/trail network. Multiple seeds = multiple candidates with 1 API call each.

```javascript
// routing/route-builder.js -- ORS round_trip approach
async generateCandidatesViaRoundTrip(startPoint, distanceKm, count = 3) {
  const candidates = [];
  for (let seed = 0; seed < count + 2; seed++) {
    try {
      const result = await this.orsAdapter.roundTrip(startPoint, {
        length: distanceKm * 1000, // ORS expects meters
        points: 5,                  // More points = more circular shape
        seed: seed
      });
      if (result && result.features?.length > 0) {
        candidates.push(result);
      }
    } catch (err) {
      // Some seeds may fail; continue with others
      console.warn(`Round trip seed ${seed} failed:`, err.message);
    }
  }
  return candidates;
}
```

### Pattern 2: Waypoint-Based Trail Forcing
**What:** Pre-select trail waypoints from scored OSM data, arrange them in a loop, and route between consecutive pairs to force the routing engine through trails.
**When:** When ORS round_trip produces road-heavy routes, or when specific trail segments should be included.
**Why:** This is the key insight from Pitfall #3 (Road Bias). Placing waypoints ON trail segments forces the router through trails even when its default profile prefers roads.

```javascript
// routing/route-builder.js -- Waypoint-based approach
async generateCandidateViaWaypoints(startPoint, trails, distanceKm) {
  // 1. Score and rank nearby trail segments
  const scored = this.scorer.scoreTrails(trails, startPoint);
  const topTrails = scored.slice(0, 8);

  // 2. Select waypoints on top trail segments arranged in a loop
  const waypoints = this.buildLoopWaypoints(startPoint, topTrails, distanceKm);

  // 3. Route between consecutive waypoints (start -> wp1 -> wp2 -> ... -> start)
  const waypointsWithReturn = [...waypoints, startPoint];
  const result = await this.engineManager.route(waypointsWithReturn);

  return result;
}

buildLoopWaypoints(start, trails, targetDistanceKm) {
  // Place waypoints at ~equal angular spacing around the start point
  // Snap each to the nearest scored trail segment
  const radius = targetDistanceKm / (2 * Math.PI); // rough circle radius
  const numPoints = 4; // 4 waypoints creates a natural loop
  const waypoints = [];

  for (let i = 0; i < numPoints; i++) {
    const bearing = (360 / numPoints) * i;
    const candidate = destination(point([start.lng, start.lat]), radius, bearing);
    // Snap to nearest trail
    const snapped = this.snapToNearestTrail(candidate, trails);
    waypoints.push(snapped);
  }
  return waypoints;
}
```

### Pattern 3: Multi-Factor Scoring Formula
**What:** Score each route candidate using a weighted combination of surface quality, trail continuity, scenic proximity, and trail-type preference.
**When:** After route candidates are generated, before ranking and presenting to user.
**Why:** Prevents the "proximity wins" anti-pattern (Pitfall #4). Quality signals matter more than distance from start.

```javascript
// scoring/scorer.js
export class RouteScorer {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  scoreRoute(routeGeoJSON, trailData, startPoint) {
    const surfaceScore = scoreSurface(routeGeoJSON, trailData);
    const continuityScore = scoreContinuity(routeGeoJSON);
    const trailPrefScore = scoreTrailPreference(routeGeoJSON, trailData);
    const scenicScore = scoreScenic(routeGeoJSON, trailData);

    return {
      total: this.weights.surface * surfaceScore
           + this.weights.continuity * continuityScore
           + this.weights.trailPreference * trailPrefScore
           + this.weights.scenic * scenicScore,
      breakdown: { surfaceScore, continuityScore, trailPrefScore, scenicScore }
    };
  }
}

const DEFAULT_WEIGHTS = {
  surface: 0.25,
  continuity: 0.25,
  trailPreference: 0.30,
  scenic: 0.20
};
```

### Pattern 4: Iterative Distance Refinement
**What:** Generate route, measure actual distance, adjust target, regenerate until within 10% of requested distance.
**When:** After initial route generation, before presenting to user.
**Why:** ORS `round_trip.length` is a "preferred value, but results may be different." Haversine underestimates by 10-40%. Must verify and adjust.

```javascript
// routing/route-builder.js
async refineDistance(startPoint, targetKm, maxIterations = 3) {
  let adjustedTarget = targetKm;
  let bestCandidate = null;

  for (let i = 0; i < maxIterations; i++) {
    const candidate = await this.generateCandidateViaRoundTrip(startPoint, adjustedTarget, 1);
    if (!candidate.length) break;

    const actualKm = length(candidate[0], { units: 'kilometers' });
    const error = Math.abs(actualKm - targetKm) / targetKm;

    if (error <= 0.10) {
      return candidate[0]; // Within 10% tolerance
    }

    // Adjust: if route was too long, reduce target; if too short, increase
    const ratio = targetKm / actualKm;
    adjustedTarget = adjustedTarget * ratio;
    bestCandidate = candidate[0];
  }

  return bestCandidate; // Best effort after max iterations
}
```

### Pattern 5: EventBus Integration for Route Pipeline
**What:** Route generation pipeline communicates via EventBus events, consistent with Phase 1 architecture.
**When:** All inter-module communication in the route building pipeline.

```
Event flow:
  'route:generate-requested' -> { startPoint, distanceKm, mode }
  'route:candidates-generated' -> { candidates: GeoJSON[] }
  'route:scoring-started' -> { candidateCount }
  'route:scoring-completed' -> { rankedRoutes: ScoredRoute[] }
  'route:generation-complete' -> { routes: ScoredRoute[], bestRoute: ScoredRoute }
  'route:generation-failed' -> { error, partialResults }
```

### Anti-Patterns to Avoid

- **Naive start-to-end routing:** Do NOT send just start/end to ORS and expect trail-aware results. The foot-hiking profile still biases toward roads. Use waypoint-based forcing or round_trip.
- **Single routing call per generation:** Do NOT generate only 1 route and present it. Generate 3+ candidates with different approaches (seeds, waypoint variations) and rank them.
- **Hardcoded scoring weights:** Do NOT embed weight values in scoring functions. Use a configurable weights object that varies by region profile (from Phase 1's `region-profiles.js`).
- **Distance from waypoints:** Do NOT compute route distance from waypoint-to-waypoint haversine. Always use `@turf/length` on the actual routed GeoJSON geometry.
- **Scoring on main thread:** For Phase 2, scoring can run on the main thread (scoring a few candidates is fast). Web Worker offloading is deferred to Phase 4 (ARCH-03). Do not prematurely optimize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loop route geometry | Custom circle-based waypoint generator only | ORS `round_trip` API parameter | ORS has a proven loop generation algorithm that respects the road network. Custom approach is a supplement, not a replacement. |
| Distance measurement | Haversine between waypoints | `@turf/length` on actual GeoJSON LineString | Haversine underestimates by 10-40%. Turf measures actual geometry. |
| Point-at-distance calculation | Manual trigonometry | `@turf/destination(point, distance, bearing)` | Turf handles geodesic calculations correctly on the ellipsoid. |
| Point snapping to trail | Brute-force distance checks | `@turf/nearest-point-on-line` | Efficient and handles edge cases (line endpoints, curves). |
| GeoJSON feature construction | Manual object literals everywhere | `@turf/helpers` (point, lineString, featureCollection) | Consistent, validated GeoJSON structure. |

**Key insight:** ORS already solves the hardest problem (generating a closed-loop route on a real road/trail network). Stride's value-add is the scoring, trail preference forcing, and multi-candidate ranking -- not reimplementing loop geometry from scratch.

## Common Pitfalls

### Pitfall 1: ORS Round Trip + Alternative Routes Incompatibility
**What goes wrong:** Attempting to combine `round_trip` and `alternative_routes` in a single ORS request causes 400 errors. These features are mutually exclusive.
**Why it happens:** ORS's internal algorithm for round trips generates a single randomized loop. The alternative routes algorithm requires fixed start/end points to find different paths between them.
**How to avoid:** Generate multiple round trip candidates using different `seed` values instead of `alternative_routes`. Each seed produces a different loop shape. Generate count+2 seeds and keep the top count results.
**Warning signs:** 400 errors from ORS when generating routes. Only 1 route returned when 3 were expected.

### Pitfall 2: ORS Round Trip Distance Inaccuracy
**What goes wrong:** ORS `round_trip.length` is documented as "a preferred value, but results may be different." Actual routes can be 50-200% of the requested distance, especially in areas with sparse trail networks.
**Why it happens:** ORS must close the loop using available road/trail network. In sparse areas, the closest loop may be much longer or shorter than requested.
**How to avoid:** Implement iterative distance refinement. Generate, measure with `@turf/length`, adjust target proportionally, regenerate. Cap at 3 iterations. Accept 10% tolerance. Trail Router filters at 50-200% of target as initial gate, then scores by distance accuracy.
**Warning signs:** Routes consistently 30%+ off requested distance. Iterative loop does not converge after 3 iterations.

### Pitfall 3: Road Bias Despite Foot-Hiking Profile
**What goes wrong:** ORS foot-hiking profile still routes on roads when parallel trails exist. The `green: { factor: 1.0 }` and `quiet: { factor: 1.0 }` weightings help but do not guarantee trail preference.
**Why it happens:** Routing engines optimize for navigability, not recreation. Paved roads get higher speed ratings than trails. "Green" weighting is an additive preference, not an override.
**How to avoid:** Supplement ORS round_trip with waypoint-based trail forcing for at least 1 of the 3+ candidates. Place waypoints ON scored trail segments, then route between consecutive pairs. This forces the router through trails regardless of its speed preferences.
**Warning signs:** Route geometry overlays show routes on roads when zooming in reveals parallel trails within 100m.

### Pitfall 4: ORS Rate Limit Exhaustion from Multiple Candidates
**What goes wrong:** Generating 3+ candidates with iterative refinement can consume 9-15 ORS API calls per route generation. At 2,000 req/day, this limits total daily generations to ~130-220.
**Why it happens:** Each candidate needs 1+ ORS calls, and iterative refinement multiplies this.
**How to avoid:** Cache aggressively (already in EngineManager from Phase 1). Use OSRM for waypoint-based candidates (no rate limit). Reserve ORS for round_trip calls where its unique capability matters. Batch waypoints into single multi-waypoint requests. Track daily ORS usage and fall back to OSRM-only when approaching limits.
**Warning signs:** 429 errors from ORS increasing. Route generation failures in afternoon/evening.

### Pitfall 5: Scoring Without Sufficient Data
**What goes wrong:** OSM `surface` tags are missing on 30-60% of ways globally. Scoring based on surface quality returns 0 (unknown) for many segments, making scores uninformative.
**Why it happens:** OSM surface tagging is inconsistent globally. US and developing regions have sparse surface data. Europe and Japan are better.
**How to avoid:** Treat missing surface as "neutral" (0.5 score), not "bad" (0.0). Use highway type as a proxy: `path` and `track` are more likely unpaved; `footway` and `cycleway` are more likely paved. Weight scoring factors that have data available more heavily. Make scoring robust to missing data.
**Warning signs:** All candidates score nearly identically. Surface score is 0 for most segments.

### Pitfall 6: Ugly Loop Shapes (Rectangles, Figure-Eights)
**What goes wrong:** Cardinal-direction waypoint placement (N, E, S, W) produces rectangular-looking routes. Random waypoint placement can produce figure-eight or bowtie shapes.
**Why it happens:** Simple geometric approaches ignore actual trail topology.
**How to avoid:** Use ORS `round_trip.points` parameter (5-8 points produces more circular shapes). For waypoint-based approach, place waypoints on actual trail geometry (snapped to trails) rather than pure geometric positions. Trail Router's improved approach uses geographic features (parks, waterfront) as waypoint attractors.
**Warning signs:** Routes have sharp 90-degree turns at waypoints. Routes cross themselves (figure-eight pattern).

## Code Examples

### ORS Round Trip Request Body
```javascript
// Source: ORS API documentation - routing-options
// POST https://api.openrouteservice.org/v2/directions/foot-hiking/geojson
{
  "coordinates": [[startLng, startLat]],  // Single point for round trip
  "options": {
    "round_trip": {
      "length": 5000,    // Target distance in meters
      "points": 5,       // Number of waypoints (more = more circular)
      "seed": 42         // Different seed = different route
    },
    "profile_params": {
      "weightings": {
        "green": { "factor": 1.0 },
        "quiet": { "factor": 1.0 }
      }
    }
  },
  "preference": "recommended",
  "units": "km",
  "geometry": true,
  "instructions": false
}
```

### ORS Alternative Routes Request Body
```javascript
// Source: ORS API documentation + community forum
// For point-to-point with alternatives (NOT combinable with round_trip)
{
  "coordinates": [[startLng, startLat], [endLng, endLat]],
  "alternative_routes": {
    "target_count": 3,        // Request 3 alternatives
    "share_factor": 0.6,      // Max 60% shared with optimal route
    "weight_factor": 1.8      // Max 1.8x the optimal weight
  },
  "preference": "recommended",
  "units": "km",
  "geometry": true
}
```

### Surface Quality Scoring Factor
```javascript
// scoring/factors/surface.js
// OSM surface tag values ranked by running quality
const SURFACE_SCORES = {
  // Excellent running surfaces
  'tartan': 1.0,           // Athletic track surface
  'fine_gravel': 0.95,     // Packed gravel trail
  'compacted': 0.90,       // Compacted earth
  'asphalt': 0.85,         // Paved (good but less scenic)
  'concrete': 0.80,        // Paved
  'paving_stones': 0.75,   // Cobblestone-like

  // Good running surfaces
  'gravel': 0.70,
  'ground': 0.65,
  'dirt': 0.65,
  'earth': 0.60,
  'grass': 0.55,
  'woodchips': 0.50,

  // Poor running surfaces
  'sand': 0.30,
  'mud': 0.15,
  'snow': 0.10,
  'ice': 0.05,

  // Unknown -- treat as neutral
  'unknown': 0.50
};

export function scoreSurface(routeGeoJSON, trailData) {
  // Match route segments to nearby trail features
  // Average the surface scores weighted by segment length
  let totalScore = 0;
  let totalLength = 0;

  for (const feature of trailData.features) {
    const surface = feature.properties.surface || 'unknown';
    const segLength = length(feature, { units: 'kilometers' });
    const score = SURFACE_SCORES[surface] ?? SURFACE_SCORES['unknown'];
    totalScore += score * segLength;
    totalLength += segLength;
  }

  return totalLength > 0 ? totalScore / totalLength : 0.5;
}
```

### Trail Preference Scoring Factor
```javascript
// scoring/factors/trail-preference.js
// Highway types ranked by "trail-ness" -- how much a runner prefers this type
const HIGHWAY_PREFERENCE = {
  'path': 1.0,             // Best: dedicated trail
  'footway': 0.90,         // Designated pedestrian way
  'track': 0.85,           // Farm/forest track
  'bridleway': 0.80,       // UK-style bridleway
  'cycleway': 0.70,        // Shared-use path
  'pedestrian': 0.65,      // Pedestrian zone
  'steps': 0.40,           // Stairs (necessary evil)
  'living_street': 0.35,   // Residential shared space
  'residential': 0.20,     // Regular street
  'unclassified': 0.15,    // Minor road
  'service': 0.10,         // Service road
  'tertiary': 0.05,        // Major road -- avoid
};

export function scoreTrailPreference(routeGeoJSON, trailData) {
  // For each segment of the route, check which OSM trail features
  // it overlaps with and score based on highway type
  // ...similar weighted average as surface scoring
}
```

### Continuity Scoring Factor
```javascript
// scoring/factors/continuity.js
// Score based on how connected/continuous the trail segments are
// Long unbroken trail > many short disconnected segments

export function scoreContinuity(routeGeoJSON) {
  const route = routeGeoJSON.features[0];
  const coords = route.geometry.coordinates;
  const totalLength = length(route, { units: 'kilometers' });

  // Count direction changes > 90 degrees (indicates backtracking or zig-zag)
  let sharpTurns = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    const bearingIn = bearing(point(coords[i-1]), point(coords[i]));
    const bearingOut = bearing(point(coords[i]), point(coords[i+1]));
    const turnAngle = Math.abs(bearingOut - bearingIn);
    if (turnAngle > 120 || turnAngle < -120) sharpTurns++;
  }

  // Fewer sharp turns = better continuity
  const turnPenalty = Math.min(sharpTurns / coords.length, 1.0);
  return 1.0 - turnPenalty;
}
```

## ORS API Reference for Phase 2

### Round Trip Parameters
| Parameter | Type | Description | Constraint |
|-----------|------|-------------|------------|
| `options.round_trip.length` | Number | Target route length in **meters** | Max 100,000m (100km) |
| `options.round_trip.points` | Integer | Number of waypoints for loop shape | More points = more circular |
| `options.round_trip.seed` | Integer | Randomization seed | Different seed = different route |

### Alternative Routes Parameters (point-to-point only)
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `alternative_routes.target_count` | Integer | Number of alternatives | Max 3 |
| `alternative_routes.share_factor` | Float | Max fraction shared with optimal | 0.6 |
| `alternative_routes.weight_factor` | Float | Max weight divergence from optimal | 1.4 |

### Critical Constraints
- `round_trip` and `alternative_routes` are **mutually exclusive** -- cannot combine in one request
- Round trip requires **exactly 1 coordinate** (the start/end point)
- Alternative routes requires **exactly 2 coordinates** (start and end)
- Maximum distance for both features: **100 km**
- ORS free tier: **2,000 requests/day**, **40 requests/minute**
- Maximum waypoints per request: **50**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cardinal-direction waypoints (N,E,S,W at fixed distance) | Feature-based waypoints (parks, trails, waterfront) | Trail Router ~2020 | Routes feel organic instead of geometric |
| Single route generation | 3+ candidates with seed variation | ORS round_trip feature, ~2019 | Users choose preferred option |
| Proximity-only scoring | Multi-factor scoring (surface, continuity, scenic, trail type) | Trail Router blog, academic research 2020-2024 | Routes optimize for quality, not just proximity |
| Haversine distance estimation | Routed geometry measurement via Turf.js | Standard practice | Accurate distance within 5% vs 10-40% error |
| Custom loop construction algorithms | Routing engine round_trip APIs | ORS, GraphHopper ~2018 | Leverage routing engine's network graph instead of hand-building loops |

**Deprecated/outdated:**
- Direct Strava heatmap integration: Strava API agreement (Nov 2024) prohibits this. Use OSM signals instead.
- Leaflet 2.0 alpha: Not stable enough for production. Stay on 1.9.4.
- Full @turf/turf bundle: Always use individual packages.

## Open Questions

1. **Optimal number of ORS round_trip points parameter**
   - What we know: More points = more circular routes. Range is roughly 3-8.
   - What's unclear: What value produces the most "natural" loop shape for running routes specifically.
   - Recommendation: Default to 5, make configurable. Test with 3, 5, and 8 during development to calibrate.

2. **Trail-to-route matching for scoring**
   - What we know: We have trail GeoJSON from Overpass and route GeoJSON from ORS. Need to determine which trail segments a generated route actually follows.
   - What's unclear: The exact spatial matching algorithm (buffer intersection? nearest-line matching? coordinate proximity?).
   - Recommendation: Use `@turf/nearest-point-on-line` to match route sample points to trail segments within 50m tolerance. This is a heuristic but sufficient for scoring.

3. **How many ORS API calls per route generation is acceptable?**
   - What we know: Free tier is 2,000/day. Each generation currently uses 1 ORS call (Phase 1). Phase 2 will use 3-5+ per generation.
   - What's unclear: Actual daily generation count for the single developer user.
   - Recommendation: Budget 5 ORS calls per generation (3 round_trip seeds + 2 refinement iterations). That supports 400 generations/day. Use OSRM for waypoint-based candidates to reduce ORS load.

4. **Scoring weight calibration**
   - What we know: Weights must differ by region (Japan prefers surface quality; US prefers trail continuity).
   - What's unclear: Optimal weight values per region.
   - Recommendation: Start with equal weights (0.25 each), make them configurable in the weights module, tune empirically in Phase 5 (Global Validation).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | Loop route generation returns circular route | unit | `npx vitest run tests/routing/route-builder.test.js -t "loop"` | Wave 0 |
| ROUTE-02 | Route distance within 10% of requested | unit | `npx vitest run tests/routing/route-builder.test.js -t "distance"` | Wave 0 |
| ROUTE-03 | 3+ ranked route candidates returned | unit | `npx vitest run tests/routing/route-builder.test.js -t "candidates"` | Wave 0 |
| ROUTE-04 | Trail preference in scoring | unit | `npx vitest run tests/scoring/trail-preference.test.js` | Wave 0 |
| ROUTE-07 | Multi-factor scoring with 4+ factors | unit | `npx vitest run tests/scoring/scorer.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/routing/route-builder.test.js` -- covers ROUTE-01, ROUTE-02, ROUTE-03
- [ ] `tests/scoring/scorer.test.js` -- covers ROUTE-07 (multi-factor scoring)
- [ ] `tests/scoring/surface.test.js` -- covers ROUTE-04 (surface quality factor)
- [ ] `tests/scoring/trail-preference.test.js` -- covers ROUTE-04 (trail type preference)
- [ ] `tests/scoring/continuity.test.js` -- covers continuity factor
- [ ] `tests/scoring/scenic.test.js` -- covers scenic proximity factor
- [ ] `tests/scoring/weights.test.js` -- covers configurable weight profiles

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond already-installed npm packages). Phase 2 is purely code changes to the existing codebase. All external APIs (ORS, OSRM, Overpass) are already configured from Phase 1. Turf.js packages install from npm.

## Sources

### Primary (HIGH confidence)
- [ORS Routing Options Documentation](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options) - round_trip parameters (length, points, seed), routing options structure
- [ORS API Restrictions](https://openrouteservice.org/restrictions/) - 100km max for round_trip, 2000 req/day, 50 waypoints max, 3 max alternatives
- [ORS Alternative Routes Forum](https://ask.openrouteservice.org/t/how-does-alternative-routes-work/3572) - Confirmed round_trip + alternative_routes are mutually exclusive; use different seeds as workaround
- [Turf.js Documentation](https://turfjs.org/) - Individual package APIs for bearing, destination, length, along, nearest-point-on-line
- [OSM Highway Tags](https://wiki.openstreetmap.org/wiki/Tag:highway=path) - Complete highway type taxonomy for trail preference scoring
- [OSRM Trip Service](https://project-osrm.org/docs/v5.9.1/api/) - Round trip via TSP with farthest-insertion heuristic

### Secondary (MEDIUM confidence)
- [Trail Router: How It Works](https://trailrouter.com/blog/how-trail-router-works/) - Green index scoring (30m buffer), visited-edges repetition avoidance, round-trip waypoint generation, distance filtering (50-200% tolerance), scoring by green index + distance accuracy
- [Circular Route Planning Algorithm](https://medium.com/@inzi.tahir/circular-route-planning-8e30125baa7d) - Cardinal-direction segmentation, iterative distance refinement with Dijkstra, route variation via segment reordering
- [Automatic Route Planning Generator](https://medium.com/@jordy.bonnet_67692/automatic-route-planning-generator-16a266d468a5) - Bayesian optimization for waypoint placement, OSMnx for street network, SRTM for elevation
- [ORS Round Trip Forum](https://ask.openrouteservice.org/t/round-trip-request/1622) - Community experience with round_trip feature, distance accuracy feedback
- [HeiGIT: ORS Alternative Routes and Roundtrips](https://heigit.org/openrouteservice-maps-alternative-routes-roundtrips-and-more/) - Feature announcement, capability overview

### Tertiary (LOW confidence)
- Region-specific circuity factors (urban: 1.2, mountain: 1.6-2.0) -- from geographic literature, not validated for running routes specifically
- Optimal `round_trip.points` value (5 recommended) -- based on general guidance, needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified at current versions via npm registry. ORS and OSRM APIs documented and already integrated in Phase 1.
- Architecture: MEDIUM-HIGH - Loop generation via ORS round_trip is documented but the hybrid approach (round_trip + waypoint forcing) is Stride-specific and unvalidated. Trail Router's approach is proven but uses GraphHopper (different engine).
- Scoring: MEDIUM - Multi-factor scoring patterns are well-documented (Trail Router blog). Specific weight calibration is unknown and needs empirical tuning.
- Pitfalls: HIGH - Road bias, distance accuracy, round_trip limitations all corroborated across ORS forums, Trail Router blog, and OSM community.

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- ORS API is stable, Turf.js is stable, patterns are proven)
