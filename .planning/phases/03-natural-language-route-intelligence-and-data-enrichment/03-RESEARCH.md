# Phase 3: Natural Language, Route Intelligence, and Data Enrichment - Research

**Researched:** 2026-03-27
**Domain:** LLM-powered NL parsing, OSM data enrichment, route explanation generation
**Confidence:** HIGH

## Summary

Phase 3 adds four capabilities to Stride: (1) natural language input parsing that translates user "vibes" into scoring weight adjustments, (2) route quality explanations that describe why each route was chosen, (3) multi-source OSM data fusion combining trail geometry with land-use polygons, surface tags, and naming, and (4) green space scoring that calculates proximity to parks, water bodies, and nature reserves for each route segment.

The Claude API can be called directly from the browser using the `anthropic-dangerous-direct-browser-access: true` header, which aligns with Stride's no-backend PWA constraint. The API key is already stored in localStorage as `stride_api_key`. For cost efficiency, Claude Haiku 4.5 ($1/$5 per MTok) is the right model for structured NL parsing -- it supports structured outputs (guaranteed JSON schema compliance via `output_config.format`) and is 5x cheaper than Sonnet. The NL input module should parse user descriptions into a weight adjustment object that feeds into the existing `RouteScorer`, not generate routes directly.

**Primary recommendation:** Build a `NLParser` adapter that calls Claude Haiku 4.5 with structured outputs to convert user text into weight overrides, a `GreenSpaceScorer` that queries Overpass for land-use polygons and scores route proximity, a `DataFusion` module that enriches trail GeoJSON with land-use context, and a `RouteExplainer` that generates human-readable explanations from score breakdowns and trail metadata.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-05 | User can describe desired route in natural language ("shady waterfront trail", "hilly forest run") | NL Parser using Claude Haiku 4.5 structured outputs to convert vibes into weight adjustments for existing RouteScorer |
| ROUTE-06 | Each route includes a quality explanation -- why this route was chosen and what makes it good | RouteExplainer module uses Claude Haiku 4.5 to generate explanation from score breakdown + trail metadata |
| DATA-03 | Multi-source data fusion combines OSM trail geometry, route relations, land-use polygons, surface tags, and trail naming | Extended Overpass queries fetch land-use polygons alongside trails; DataFusion module enriches route GeoJSON with context |
| DATA-04 | Green space scoring calculates proximity to parks, nature reserves, water bodies, and tree cover for each route segment | GreenSpaceScorer using @turf/boolean-point-in-polygon and @turf/buffer to score route segments against land-use polygons |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No backend:** PWA runs entirely client-side. API keys stored in localStorage.
- **API rate limits:** ORS free tier is 2000 req/day.
- **Single developer:** Architecture must be understandable and maintainable.
- **GSD Workflow Enforcement:** Use GSD commands for all file changes.
- **Stack:** Vite 8, Leaflet 1.9.4, individual @turf/* packages, idb, vitest. No frontend frameworks.
- **Do NOT install the full @turf/turf package** -- use individual modules.
- **Do NOT use a backend / serverless functions** -- client-side only.
- **Do NOT rely on Strava heatmap as a core data source.**

## Standard Stack

### Core (New for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Haiku 4.5 (API) | messages v1 | NL parsing + route explanation generation | Cheapest Claude model ($1/$5 per MTok) that supports structured outputs. No SDK needed -- direct fetch() with CORS header. |
| @turf/buffer | 7.3.4 | Buffer route lines for proximity scoring | Creates polygon buffers around LineStrings for intersection with green spaces |
| @turf/point-on-feature | 7.3.4 | Sample points along route for polygon checks | Generates representative points on route geometry for land-use classification |

### Already Installed (Phase 1/2)

| Library | Version | Purpose | Relevant to Phase 3 |
|---------|---------|---------|---------------------|
| @turf/boolean-point-in-polygon | 7.3.4 | Point-in-polygon test | Core of green space scoring -- test if route points fall inside park/water polygons |
| @turf/length | 7.3.4 | Line length measurement | Length-weighted scoring for green space coverage |
| @turf/along | 7.3.4 | Point along line | Sample points at regular intervals along route for land-use scoring |
| @turf/helpers | 7.3.4 | GeoJSON construction | Build polygon features from Overpass land-use data |
| @turf/distance | 7.3.4 | Point distance | Proximity calculations for nearest green space |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude Haiku 4.5 | Claude Sonnet 4.6 | 3x more expensive input, 3x output; better quality but NL parsing is a simple structured task -- Haiku is sufficient |
| Claude Haiku 4.5 | Local regex/keyword parser | No API cost, but cannot interpret nuanced phrases like "shady waterfront trail near downtown" -- misses the core differentiator |
| @turf/buffer | Manual polygon expansion | Buffer is a complex geometric operation with edge cases -- Turf handles it correctly |
| Direct fetch() | @anthropic-ai/sdk | SDK adds bundle size (~50KB+) and complexity; fetch() with 5 headers is simpler for a single endpoint |

**Installation:**
```bash
npm install @turf/buffer @turf/point-on-feature
```

**Version verification:** All @turf packages confirmed at 7.3.4 via npm registry (2026-03-27).

## Architecture Patterns

### Recommended Project Structure (New Modules)

```
src/
  nl/
    nl-parser.js           # Claude API adapter -- vibes to weights
    route-explainer.js     # Claude API adapter -- scores to explanation text
    claude-client.js       # Shared Claude API fetch wrapper (CORS, error handling)
    prompt-templates.js    # System prompts for NL parsing and explanation
  scoring/
    factors/
      scenic.js            # MODIFY: enhanced with land-use polygon data
      green-space.js       # NEW: dedicated green space proximity scorer
    weights.js             # MODIFY: add NL weight override merging
    scorer.js              # MODIFY: accept optional NL weight overrides
  data/
    query-builder.js       # MODIFY: add land-use/green-space query
    enrichment.js          # NEW: fuse trail data with land-use context
    adapters/
      overpass.js           # MODIFY: add fetchLandUse() method
```

### Pattern 1: Claude API Client Adapter (Browser Direct)

**What:** A thin fetch wrapper that calls the Claude Messages API directly from the browser with CORS enabled.
**When:** Every NL parsing request and route explanation generation.
**Why:** Stride has no backend. The Claude API supports direct browser access via the `anthropic-dangerous-direct-browser-access: true` header. The API key is already in localStorage as `stride_api_key`.

```javascript
// Source: https://platform.claude.com/docs/en/api/messages + CORS docs
// nl/claude-client.js
export class ClaudeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.anthropic.com/v1/messages';
  }

  async complete(systemPrompt, userMessage, outputSchema, options = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: options.model || 'claude-haiku-4-5-20250514',
        max_tokens: options.maxTokens || 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        output_config: outputSchema ? {
          format: {
            type: 'json_schema',
            schema: outputSchema
          }
        } : undefined
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${err.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    return outputSchema ? JSON.parse(text) : text;
  }
}
```

### Pattern 2: NL Parser -- Vibes to Weight Adjustments

**What:** Takes a natural language description and returns scoring weight overrides and feature preferences.
**When:** User types a route description before generating routes.
**Why:** The NL parser is the bridge between user intent and the algorithmic scoring pipeline. It does NOT generate routes -- it adjusts how routes are scored.

```javascript
// nl/nl-parser.js
const WEIGHT_SCHEMA = {
  type: 'object',
  properties: {
    weights: {
      type: 'object',
      properties: {
        surface: { type: 'number' },
        continuity: { type: 'number' },
        trailPreference: { type: 'number' },
        scenic: { type: 'number' },
        greenSpace: { type: 'number' }
      },
      required: ['surface', 'continuity', 'trailPreference', 'scenic', 'greenSpace']
    },
    preferences: {
      type: 'object',
      properties: {
        preferWater: { type: 'boolean' },
        preferParks: { type: 'boolean' },
        preferForest: { type: 'boolean' },
        preferHills: { type: 'boolean' },
        preferFlat: { type: 'boolean' },
        preferPaved: { type: 'boolean' },
        preferTrails: { type: 'boolean' }
      },
      required: ['preferWater', 'preferParks', 'preferForest',
                  'preferHills', 'preferFlat', 'preferPaved', 'preferTrails']
    },
    vibeKeywords: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['weights', 'preferences', 'vibeKeywords'],
  additionalProperties: false
};
```

### Pattern 3: Green Space Scoring via Overpass Polygon Query

**What:** Fetch land-use polygons (parks, forests, water) from Overpass, then score route segments by how much of their length passes through green areas.
**When:** During route scoring, after trail data is fetched.
**Why:** DATA-04 requires green space proximity scoring. The current scenic.js only counts features with green/water tags -- it does not check whether the route actually passes through green areas.

```
Overpass query for land-use polygons:
[out:json][timeout:60];
(
  way["leisure"~"^(park|garden|nature_reserve)$"](BBOX);
  way["landuse"~"^(forest|grass|meadow|recreation_ground)$"](BBOX);
  way["natural"~"^(water|wood|grassland|wetland)$"](BBOX);
  way["waterway"~"^(river|stream|canal)$"](BBOX);
  relation["leisure"~"^(park|garden|nature_reserve)$"](BBOX);
  relation["landuse"~"^(forest|grass|meadow|recreation_ground)$"](BBOX);
  relation["natural"~"^(water|wood|grassland|wetland)$"](BBOX);
);
out body geom;
```

### Pattern 4: Route Explanation Generation

**What:** After scoring, pass the score breakdown and trail metadata to Claude to generate a human-readable explanation.
**When:** After routes are scored and ranked.
**Why:** ROUTE-06 requires each route to include a quality explanation referencing trail names, landmarks, surfaces.

```javascript
// nl/route-explainer.js
// Input: { scoreBreakdown, trailNames, surfaces, waterFeatures, greenSpaces, distanceKm }
// Output: "This 5.2km route follows Stevens Creek Trail along the waterfront,
//          with 72% of the route passing through parks and green spaces.
//          Surface is primarily compacted gravel (excellent for running)."
```

### Pattern 5: Weight Merging (NL Overrides + Region Defaults)

**What:** Merge NL-derived weight adjustments with region-detected defaults.
**When:** After NL parsing, before route scoring.
**Why:** Region weights handle data quality variations (Japan vs US); NL weights handle user intent. They must compose, not replace.

```javascript
// Merge strategy: NL weights take priority, but maintain sum-to-1.0 constraint
function mergeWeights(regionWeights, nlWeights) {
  const merged = { ...regionWeights };
  for (const [key, value] of Object.entries(nlWeights)) {
    if (value !== undefined && merged[key] !== undefined) {
      merged[key] = value;
    }
  }
  // Normalize to sum to 1.0
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(merged)) {
    merged[key] = merged[key] / sum;
  }
  return merged;
}
```

### Anti-Patterns to Avoid

- **Using Claude to generate routes directly:** The LLM should parse vibes into weights, not produce lat/lng coordinates. Routes are built algorithmically by ORS/OSRM.
- **Blocking UI on Claude API calls:** NL parsing and explanation generation are network-dependent. Always show loading state and handle timeouts gracefully.
- **Querying Overpass for land-use on every route generation:** Land-use polygons change rarely. Cache aggressively in IndexedDB with 7-day TTL.
- **Installing @anthropic-ai/sdk:** Adds unnecessary bundle size for a single fetch endpoint. Direct fetch() is simpler and smaller.
- **Hardcoding weight values in the NL prompt:** The prompt should instruct Claude to return normalized weights (0-1). Normalization to sum=1.0 happens in code, not in the LLM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NL intent parsing | Regex/keyword parser | Claude Haiku 4.5 structured outputs | Cannot handle nuance ("shady waterfront trail" needs to understand shady=tree cover, waterfront=water proximity). LLM handles this trivially. |
| Polygon buffer geometry | Manual coordinate expansion | @turf/buffer | Buffer operations involve arc interpolation, self-intersection handling, and coordinate system correction. Turf handles all edge cases. |
| Point-in-polygon testing | Ray casting algorithm | @turf/boolean-point-in-polygon | Already installed. Handles holes in polygons, edge cases with points on boundary. |
| JSON schema validation for API responses | Manual parsing with try/catch | Claude structured outputs (`output_config.format`) | Guaranteed valid JSON matching schema -- no parsing errors, no retries. |
| Green space polygon normalization | Custom OSM-to-GeoJSON converter | Extend existing normalizeOverpassToGeoJSON | The Overpass adapter already normalizes ways and relations to GeoJSON. Extend, do not rebuild. |

**Key insight:** The hardest part of Phase 3 is NOT the Claude API integration (that is straightforward). The hard part is the Overpass land-use query design and the geometric scoring of route-to-polygon proximity. The existing scenic.js counts nearby features but does not calculate what percentage of a route actually passes through green space -- that requires true geometric intersection.

## Common Pitfalls

### Pitfall 1: Claude API Key Exposure in Client-Side Code

**What goes wrong:** API key embedded in JavaScript source is visible to anyone who opens browser DevTools.
**Why it happens:** PWA has no backend to proxy requests.
**How to avoid:** This is an ACCEPTED RISK documented in PROJECT.md ("API keys stored in localStorage"). The key is per-user (user provides their own key via settings UI). The `anthropic-dangerous-direct-browser-access` header explicitly opts into this pattern. Stride is a personal tool, not a multi-tenant SaaS.
**Warning signs:** If Stride ever becomes publicly hosted with a shared key, move to Cloudflare Worker proxy.

### Pitfall 2: Overpass Query Timeout for Large Land-Use Areas

**What goes wrong:** Querying land-use polygons for a large bounding box returns huge geometry data and times out.
**Why it happens:** Parks and forests can have thousands of nodes in their polygon geometry. Requesting `out body geom` for a 10km x 10km area returns megabytes of data.
**How to avoid:** (1) Use `out center` for initial scoring (gives center point only, not full polygon), then fetch full geometry only for polygons near the route. (2) Set a reasonable timeout (60s). (3) Cache results aggressively (land-use changes rarely). (4) Consider using `out geom` only for the closest N polygons.
**Warning signs:** Overpass responses exceeding 5MB or taking >30 seconds.

### Pitfall 3: NL Weight Sum Not Normalized

**What goes wrong:** Claude returns weights that don't sum to 1.0, causing scoring to produce values outside [0, 1].
**Why it happens:** Even with structured outputs, Claude may return {"surface": 0.1, "scenic": 0.8, "trailPreference": 0.5, ...} which sums to >1.0.
**How to avoid:** Always normalize weights in code after receiving them from Claude. The prompt should ask for relative importance (0-1 scale per factor), and the merging function normalizes the total to 1.0.
**Warning signs:** Route total scores exceeding 1.0 or showing unexpected rankings.

### Pitfall 4: Green Space Scoring for Data-Sparse Regions

**What goes wrong:** Regions with no mapped parks or forests get a green space score of 0, penalizing all routes unfairly.
**Why it happens:** OSM land-use mapping is inconsistent. Rural Africa may have no mapped parks even if the area is entirely forested.
**How to avoid:** Follow the existing pattern: return a neutral base score (0.3-0.5) when no land-use data is available. Only penalize routes that are in areas where green spaces ARE mapped but the route avoids them.
**Warning signs:** All routes in a region scoring identically for green space.

### Pitfall 5: Claude API Rate Limiting

**What goes wrong:** Too many concurrent Claude API calls fail with 429 status.
**Why it happens:** NL parsing fires on every "Generate" click, and explanation generation fires for every scored route (potentially 3-5 per generation).
**How to avoid:** (1) Debounce NL parsing -- only parse when user clicks "Generate", not on every keystroke. (2) Generate explanations only for the top 3 routes, not all candidates. (3) Cache NL parse results for identical input strings. (4) Batch explanation generation into a single Claude call with all routes.
**Warning signs:** 429 errors in DevTools console, slow UI response.

### Pitfall 6: Overpass Land-Use Query Returning Ways Instead of Closed Polygons

**What goes wrong:** @turf/boolean-point-in-polygon expects Polygon geometry, but Overpass returns LineString for unclosed ways.
**Why it happens:** Not all land-use features in OSM are closed ways. Some are mapped as open ways or require relation assembly.
**How to avoid:** (1) Filter results: only use features whose first and last coordinates match (closed polygon). (2) For relations, assemble member ways into polygons. (3) Fallback to buffer-based proximity for features that cannot form polygons.
**Warning signs:** `booleanPointInPolygon` throwing errors or returning unexpected results.

## Code Examples

### Claude Haiku 4.5 Direct Browser Call with Structured Outputs

```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// + https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': localStorage.getItem('stride_api_key'),
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20250514',
    max_tokens: 512,
    system: 'You are a running route preference parser...',
    messages: [{ role: 'user', content: 'shady waterfront trail' }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            weights: {
              type: 'object',
              properties: {
                surface: { type: 'number' },
                continuity: { type: 'number' },
                trailPreference: { type: 'number' },
                scenic: { type: 'number' },
                greenSpace: { type: 'number' }
              },
              required: ['surface', 'continuity', 'trailPreference', 'scenic', 'greenSpace']
            }
          },
          required: ['weights'],
          additionalProperties: false
        }
      }
    }
  })
});

const data = await response.json();
const parsed = JSON.parse(data.content[0].text);
// parsed.weights = { surface: 0.1, continuity: 0.15, trailPreference: 0.25, scenic: 0.3, greenSpace: 0.2 }
```

### Overpass Query for Land-Use Polygons

```javascript
// Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
// data/query-builder.js -- new function

export function buildLandUseQuery(bbox, options = {}) {
  const [south, west, north, east] = bbox;
  const timeout = options.timeout || 60;
  const bboxStr = `${south},${west},${north},${east}`;

  return `[out:json][timeout:${timeout}];
(
  way["leisure"~"^(park|garden|nature_reserve)$"](${bboxStr});
  way["landuse"~"^(forest|grass|meadow|recreation_ground)$"](${bboxStr});
  way["natural"~"^(water|wood|grassland|wetland)$"](${bboxStr});
  way["waterway"~"^(river|stream|canal)$"](${bboxStr});
  relation["leisure"~"^(park|garden|nature_reserve)$"](${bboxStr});
  relation["landuse"~"^(forest|grass|meadow|recreation_ground)$"](${bboxStr});
  relation["natural"~"^(water|wood|grassland|wetland)$"](${bboxStr});
);
out body geom;`;
}
```

### Green Space Scoring with Turf.js

```javascript
// Source: https://turfjs.org/docs/api/booleanPointInPolygon
// scoring/factors/green-space.js

import along from '@turf/along';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { length } from '@turf/length';
import { polygon } from '@turf/helpers';

export function scoreGreenSpace(routeGeoJSON, landUseFeatures) {
  if (!routeGeoJSON.features?.length || !landUseFeatures?.features?.length) {
    return 0.4; // Neutral base when no data
  }

  const route = routeGeoJSON.features[0];
  const routeLength = length(route, { units: 'kilometers' });
  if (routeLength === 0) return 0.4;

  // Sample points every 100m along route
  const sampleInterval = 0.1; // km
  const numSamples = Math.ceil(routeLength / sampleInterval);
  let greenSamples = 0;

  // Build polygon list from land-use features (filter to closed polygons only)
  const greenPolygons = landUseFeatures.features.filter(f =>
    f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
  );

  for (let i = 0; i <= numSamples; i++) {
    const dist = Math.min(i * sampleInterval, routeLength);
    const pt = along(route, dist, { units: 'kilometers' });

    for (const poly of greenPolygons) {
      if (booleanPointInPolygon(pt, poly)) {
        greenSamples++;
        break; // Count each sample once
      }
    }
  }

  const greenRatio = greenSamples / (numSamples + 1);
  // Scale: 0% green = 0.2, 100% green = 1.0
  return 0.2 + greenRatio * 0.8;
}
```

### Converting Overpass Ways to Polygon GeoJSON

```javascript
// data/enrichment.js -- normalize closed ways to Polygon geometry

export function normalizeToPolygons(overpassGeoJSON) {
  const polygons = [];

  for (const feature of overpassGeoJSON.features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      // Check if way is closed (first == last coordinate)
      if (coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]) {
        polygons.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: feature.properties
        });
      }
    } else if (feature.geometry.type === 'Polygon' ||
               feature.geometry.type === 'MultiPolygon') {
      polygons.push(feature);
    }
  }

  return { type: 'FeatureCollection', features: polygons };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `output_format` parameter (beta) | `output_config.format` (GA) | Late 2025 | Use new parameter name; old works but deprecated |
| Haiku 3 ($0.25/$1.25 per MTok) | Haiku 4.5 ($1/$5 per MTok) | 2025 | Haiku 3 deprecated April 2026; use Haiku 4.5 |
| Prompt-based JSON extraction | Structured outputs (constrained decoding) | 2025 | Guaranteed valid JSON, no parse errors |
| Count-based scenic scoring | Geometric polygon intersection | Phase 3 | Actual measurement of green space coverage vs feature counting |

**Deprecated/outdated:**
- Claude Haiku 3: Retires April 19, 2026. Do not use.
- `output_format` parameter: Moved to `output_config.format`. Old parameter still works but is deprecated.
- Beta header `structured-outputs-2025-11-13`: No longer required for structured outputs.

## Open Questions

1. **Claude model ID for Haiku 4.5**
   - What we know: The model is called "Claude Haiku 4.5" with pricing $1/$5 per MTok
   - What's unclear: The exact model ID string. Likely `claude-haiku-4-5-20250514` based on Anthropic's naming convention, but should verify against API docs or test with a real call.
   - Recommendation: Use the model ID and handle gracefully if it fails -- fall back to listing available models or prompting user to select.

2. **Overpass response size for land-use polygons**
   - What we know: Park and forest polygons can have hundreds of nodes each
   - What's unclear: Typical response size for a 5km radius around a start point
   - Recommendation: Start with `out body geom` and measure. If responses exceed 5MB consistently, switch to a two-pass approach: `out center` for initial filtering, then `out body geom` for nearby features only.

3. **Weight schema design -- how many factors?**
   - What we know: Current scorer has 4 factors (surface, continuity, trailPreference, scenic). Phase 3 adds greenSpace.
   - What's unclear: Should greenSpace be a separate factor or absorbed into scenic? Should the NL parser also adjust sub-signal weights within scenic (water vs parks vs named trails)?
   - Recommendation: Add greenSpace as a 5th top-level factor. This keeps the scoring transparent and allows the NL parser to independently control green space preference. Expand weights from 4 to 5, re-normalize.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Claude API (api.anthropic.com) | NL parsing (ROUTE-05), Explanations (ROUTE-06) | External service | Messages v1 | Graceful degradation: skip NL parsing, use default weights; skip explanations |
| Overpass API | Land-use data (DATA-03, DATA-04) | External service | v0.7.x | Already used in Phase 1 with fallback endpoints |
| @turf/buffer (npm) | Green space scoring | Not yet installed | 7.3.4 | Must install |
| @turf/point-on-feature (npm) | Route point sampling | Not yet installed | 7.3.4 | Can use @turf/along instead (already installed) |
| @turf/boolean-point-in-polygon | Green space scoring | Installed | 7.3.4 | -- |
| localStorage (stride_api_key) | Claude API auth | Browser API | -- | User prompted to enter key in settings |

**Missing dependencies with no fallback:**
- None. All external services have graceful degradation paths.

**Missing dependencies with fallback:**
- @turf/buffer and @turf/point-on-feature need to be installed via npm
- @turf/point-on-feature can be replaced with @turf/along (already installed) by sampling points at intervals

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.js |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-05 | NL parser converts "shady waterfront trail" into weight adjustments | unit | `npx vitest run tests/nl/nl-parser.test.js -t "parses"` | Wave 0 |
| ROUTE-05 | Weight merging normalizes NL overrides with region defaults | unit | `npx vitest run tests/nl/weight-merge.test.js` | Wave 0 |
| ROUTE-06 | Route explainer generates human-readable explanation from score breakdown | unit | `npx vitest run tests/nl/route-explainer.test.js` | Wave 0 |
| DATA-03 | Land-use Overpass query fetches park/forest/water polygons | unit | `npx vitest run tests/data/land-use-query.test.js` | Wave 0 |
| DATA-03 | Data enrichment fuses trail data with land-use context | unit | `npx vitest run tests/data/enrichment.test.js` | Wave 0 |
| DATA-04 | Green space scorer scores route segments by polygon proximity | unit | `npx vitest run tests/scoring/green-space.test.js` | Wave 0 |
| DATA-04 | Overpass-to-polygon normalizer converts closed ways to Polygon geometry | unit | `npx vitest run tests/data/polygon-normalize.test.js` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/nl/nl-parser.test.js` -- covers ROUTE-05 (NL parsing)
- [ ] `tests/nl/route-explainer.test.js` -- covers ROUTE-06 (explanations)
- [ ] `tests/nl/weight-merge.test.js` -- covers ROUTE-05 (weight normalization)
- [ ] `tests/data/land-use-query.test.js` -- covers DATA-03 (Overpass query)
- [ ] `tests/data/enrichment.test.js` -- covers DATA-03 (data fusion)
- [ ] `tests/data/polygon-normalize.test.js` -- covers DATA-04 (polygon conversion)
- [ ] `tests/scoring/green-space.test.js` -- covers DATA-04 (green space scoring)
- [ ] `tests/nl/` directory -- new test directory needed
- [ ] Framework install: Already installed (vitest 4.x in devDependencies)

## Sources

### Primary (HIGH confidence)

- [Anthropic Claude API Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- `output_config.format` parameter, JSON schema constrained decoding, GA for Haiku 4.5 / Sonnet 4.5+ / Opus 4.5+
- [Anthropic Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Haiku 4.5 at $1/$5 per MTok, Haiku 3 deprecated April 2026
- [Anthropic Claude API Messages Reference](https://platform.claude.com/docs/en/api/messages) -- Messages endpoint v1
- [Claude CORS Browser Access](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) -- `anthropic-dangerous-direct-browser-access: true` header for direct browser calls
- [Turf.js booleanPointInPolygon](https://turfjs.org/docs/api/booleanPointInPolygon) -- Point-in-polygon testing
- [Turf.js buffer](https://www.npmjs.com/package/@turf/buffer) -- v7.3.4, polygon buffer generation
- [OSM Key:landuse](https://wiki.openstreetmap.org/wiki/Key:landuse) -- Land-use tag documentation
- [OSM Tag:leisure=park](https://wiki.openstreetmap.org/wiki/Tag:leisure=park) -- Park tag documentation
- [Overpass API Language Guide](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide) -- Query syntax for polygons and `out center`

### Secondary (MEDIUM confidence)

- [Overpass API by Example](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) -- Land-use query patterns
- [Overpass Bounding Box Documentation](https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html) -- Bbox query syntax

### Tertiary (LOW confidence)

- Claude Haiku 4.5 model ID string `claude-haiku-4-5-20250514` -- inferred from naming convention, needs validation with live API call

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Claude API, Turf.js, and Overpass are all well-documented, stable, and already partially in use
- Architecture: HIGH -- Builds directly on Phase 2 patterns (adapters, scoring factors, event bus). NL parser follows same adapter pattern as ORS/OSRM.
- Pitfalls: HIGH -- All pitfalls are based on documented API behavior (CORS headers, Overpass response sizes) and existing project patterns (neutral base scores for missing data)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (Claude API is stable; Overpass API rarely changes; Turf.js 7.x is mature)
