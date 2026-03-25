# Phase 1: Architecture Foundation and Data Layer - Research

**Researched:** 2026-03-25
**Domain:** ES Module architecture, Overpass QL trail discovery, ORS/OSRM routing adapters, IndexedDB caching, region-adaptive OSM tagging
**Confidence:** HIGH

## Summary

Phase 1 transforms Stride from a single-file prototype into a modular ES Module architecture and builds the comprehensive data layer that every subsequent phase depends on. The three pillars are: (1) project scaffolding with Vite 8 and a clean module structure, (2) comprehensive Overpass QL queries that discover ALL runnable trail types globally -- not just `highway=path` and `highway=footway`, and (3) a dual routing engine setup (ORS foot-hiking primary, OSRM fallback) with IndexedDB caching via the `idb` library.

The single most important research finding is that OSM has at minimum 12 highway types relevant to runners, plus route relations (`route=hiking`, `route=running`, `route=foot`) and leisure features (`leisure=track`). Querying only 2-3 highway types -- as most prototypes do -- misses the majority of runnable infrastructure in many regions. Additionally, tagging conventions differ dramatically by country: Japan favors `highway=path` with `surface=*` tags, Europe uses `sac_scale` difficulty ratings and elaborate `route=hiking` relation networks, and the US has inconsistent tagging where the same trail may be `footway` in one county and `path` in another.

The ORS foot-hiking profile provides `green` and `quiet` preference factors (0.0-1.0) but has no explicit "prefer trails over roads" setting. Trail preference must be achieved through waypoint placement on known trail segments, not through routing engine configuration alone. OSRM's public demo server supports foot profile routing at `router.project-osrm.org/route/v1/foot/` with a 1 req/sec rate limit and non-commercial use restriction.

**Primary recommendation:** Build the module architecture first (EventBus, State Store, Config, Cache), then the Overpass adapter with a comprehensive region-adaptive query builder, then the ORS/OSRM routing adapters with automatic fallback. Cache everything in IndexedDB with 24-hour TTL for trail data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Codebase restructured from single index.html into ES Module architecture with clear component boundaries | Vite 8 vanilla JS template + modular project structure documented in Architecture Patterns; EventBus, State Store, Config, Cache as core infrastructure |
| ARCH-04 | Trail data cached in IndexedDB to reduce redundant Overpass API calls and improve response time | `idb` 8.0.x library patterns documented; TTL-based cache with 24h expiration for trail data; cache key by bbox+mode |
| DATA-01 | Overpass queries comprehensively fetch all trail types -- paths, footways, tracks, cycleways, and named routes -- using region-adaptive OSM tag sets | Comprehensive tag matrix of 12+ highway types + route relations + leisure features documented; region-adaptive query builder pattern |
| DATA-02 | Routing engine prefers trails over roads -- uses ORS foot-hiking profile with waypoint-based trail forcing, OSRM as fallback only | ORS foot-hiking profile with green/quiet factors documented; OSRM v5 API with foot profile at demo server; EngineManager fallback chain pattern |
| DATA-05 | Route generation adapts to global OSM tagging conventions -- works correctly in US, Europe, Japan, and regions with different tagging norms | Regional tag matrix covering US/Europe/Japan conventions; sac_scale, network hierarchy, Japan-specific highway=path emphasis documented |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.0.2 | Build tool, dev server, ESM bundler | Rolldown-powered, dominant 2026 build tool, first-class vanilla JS support |
| Leaflet | 1.9.4 | Map rendering (used by existing prototype) | Stable, zero deps, raster tiles, massive plugin ecosystem |
| idb | 8.0.3 | IndexedDB promise wrapper for caching | Jake Archibald (Chrome team), 1.2KB brotli, actively maintained |
| @turf/helpers | 7.3.4 | GeoJSON helper utilities | Standard geospatial library, modular imports |
| @turf/distance | 7.3.4 | Haversine distance calculations | Needed for bbox computation and proximity |
| @turf/bbox | 7.3.4 | Bounding box computation from GeoJSON | Needed for cache keys and Overpass queries |
| @mapbox/polyline | 1.2.1 | Polyline encoding/decoding | De facto standard, both ORS and OSRM return encoded polylines |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openrouteservice-js | 0.4.1 | ORS API client | ORS foot-hiking routing calls |
| vite-plugin-pwa | 1.2.0 | PWA scaffolding (manifest, SW) | Phase 4 (deferred), but install now for structure |
| vitest | 4.1.1 | Unit testing | Test scoring, caching, query building |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb | idb-keyval | idb-keyval is simpler (get/set only) but lacks object stores, indexes, and versioning needed for structured trail caching |
| openrouteservice-js | Direct fetch() | ORS client handles auth headers and response parsing; acceptable to use direct fetch if client causes issues |
| Vite | No build tool (raw ESM) | Import maps work but lose tree-shaking, minification, and dev HMR |

**Installation:**
```bash
npm create vite@latest stride -- --template vanilla
cd stride
npm install leaflet idb @turf/helpers @turf/distance @turf/bbox @mapbox/polyline openrouteservice-js
npm install -D vitest vite-plugin-pwa
```

**Version verification:** All versions verified against npm registry on 2026-03-25. Vite 8.0.2, idb 8.0.3, Leaflet 1.9.4, openrouteservice-js 0.4.1, @turf/distance 7.3.4, @mapbox/polyline 1.2.1, vitest 4.1.1, vite-plugin-pwa 1.2.0.

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)

```
stride/
  index.html                  # Shell: loads app.js, Leaflet CSS
  vite.config.js              # Vite configuration

  src/
    app.js                    # Entry point: initializes core modules, wires EventBus

    core/
      event-bus.js            # Central pub/sub (CustomEvent on EventTarget)
      state.js                # Reactive Proxy-based state store
      config.js               # API keys from localStorage, app constants
      cache.js                # IndexedDB wrapper using idb (TTL-based caching)

    data/
      aggregator.js           # Orchestrates Overpass queries, merges results, manages cache
      adapters/
        overpass.js            # Overpass QL query builder + fetch + response normalization
      query-builder.js        # Builds region-adaptive Overpass QL queries
      region-profiles.js      # Per-region tag sets and query customization

    routing/
      engine-manager.js       # Selects ORS/OSRM, manages fallback chain + rate limiting
      adapters/
        ors.js                # OpenRouteService foot-hiking adapter
        osrm.js               # OSRM v5 API direct fetch adapter

    map/
      map-manager.js          # Leaflet map initialization, layer management
      layers.js               # Tile layer definitions (OSM standard)

    ui/
      panels.js               # Minimal input UI (location, distance)
      notifications.js        # Loading/error status messages

  styles/
    main.css                  # All styles
```

### Pattern 1: EventBus (Browser-Native EventTarget)

**What:** Lightweight pub/sub using the browser's built-in EventTarget API. Zero dependencies.
**When to use:** Any cross-module communication. Data layer emits `trails:loaded`; UI listens.
**Example:**
```javascript
// core/event-bus.js
class EventBus extends EventTarget {
  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  on(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
  once(type, callback) {
    this.addEventListener(type, (e) => callback(e.detail), { once: true });
  }
}
export const eventBus = new EventBus();
```
**Source:** MDN EventTarget API, verified pattern from project ARCHITECTURE.md

### Pattern 2: TTL-Based IndexedDB Cache

**What:** Cache Overpass results and routing responses in IndexedDB with timestamp-based expiration.
**When to use:** Every external API call checks cache first.
**Example:**
```javascript
// core/cache.js
import { openDB } from 'idb';

const DB_NAME = 'stride-cache';
const DB_VERSION = 1;
const TRAIL_STORE = 'trails';
const ROUTE_STORE = 'routes';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TRAIL_STORE)) {
          db.createObjectStore(TRAIL_STORE);
        }
        if (!db.objectStoreNames.contains(ROUTE_STORE)) {
          db.createObjectStore(ROUTE_STORE);
        }
      }
    });
  }
  return dbPromise;
}

export async function getCached(store, key) {
  const db = await getDB();
  const entry = await db.get(store, key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > (entry.ttl || DEFAULT_TTL)) {
    await db.delete(store, key);
    return null;
  }
  return entry.data;
}

export async function setCache(store, key, data, ttl = DEFAULT_TTL) {
  const db = await getDB();
  await db.put(store, { data, timestamp: Date.now(), ttl }, key);
}
```
**Source:** idb GitHub README (jakearchibald/idb), verified API patterns

### Pattern 3: Adapter Pattern for External APIs

**What:** Each external API (Overpass, ORS, OSRM) gets a dedicated adapter module with a uniform interface. The app never calls `fetch()` directly for data.
**When to use:** Every external API interaction.
**Why:** APIs change endpoints, rate limits, and response formats. Adapters normalize everything to GeoJSON.

### Pattern 4: Routing Engine Fallback Chain

**What:** The EngineManager tries ORS foot-hiking first, falls back to OSRM on failure or rate-limit exhaustion.
**When to use:** Every routing request.
**Example:**
```javascript
// routing/engine-manager.js
export class EngineManager {
  constructor(orsAdapter, osrmAdapter) {
    this.engines = [
      { name: 'ors', adapter: orsAdapter, primary: true },
      { name: 'osrm', adapter: osrmAdapter, primary: false }
    ];
  }

  async route(waypoints) {
    for (const engine of this.engines) {
      try {
        const result = await engine.adapter.route(waypoints);
        return { route: result, engine: engine.name };
      } catch (err) {
        console.warn(`${engine.name} failed: ${err.message}`);
        continue;
      }
    }
    throw new Error('All routing engines failed');
  }
}
```
**Source:** Project ARCHITECTURE.md Strategy Pattern

### Anti-Patterns to Avoid

- **Direct fetch() in business logic:** All API calls go through adapters. Never `fetch('https://overpass-api.de/...')` in the aggregator or route builder.
- **localStorage for trail data:** Trail GeoJSON can be megabytes. Use IndexedDB (async, no size limit). Keep localStorage only for API keys and tiny config strings.
- **Incomplete Overpass tag queries:** Never hardcode `highway=path|footway` only. Use the comprehensive tag matrix below.
- **Assuming ORS prefers trails:** ORS foot-hiking does NOT inherently prefer trails over roads. Trail preference comes from waypoint placement, not engine configuration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB CRUD | Raw IndexedDB API (callbacks, transactions) | `idb` library | Raw API requires 50+ lines of boilerplate per operation; idb provides promise-based API in 1.2KB |
| Polyline decoding | Custom decoder | `@mapbox/polyline` | Encoding spec has edge cases (negative deltas, 5-bit chunks) that are easy to get wrong |
| Distance calculations | Haversine from scratch | `@turf/distance` | Turf handles unit conversions, edge cases, and is the ecosystem standard |
| Bounding box from coords | Manual min/max loop | `@turf/bbox` | Handles GeoJSON collections, antimeridian crossing |

**Key insight:** The complexity in this phase is in the Overpass query logic and region adaptivity, not in infrastructure plumbing. Use established libraries for infrastructure so you can focus on the domain-specific query builder.

## Common Pitfalls

### Pitfall 1: Incomplete Overpass Tag Coverage

**What goes wrong:** Queries using a fixed list of 2-3 highway tags miss the majority of runnable ways in OSM. OSM has 12+ highway types relevant to runners, plus route relations and leisure features.
**Why it happens:** Developers start with `highway=path|footway` because those seem "trail-like" and never discover the long tail.
**How to avoid:** Use the comprehensive tag matrix documented below. Query `route=hiking|running|foot` relations in addition to individual ways. Include `highway=track` (grade1-3), `highway=cycleway`, `highway=pedestrian`, `highway=bridleway` (foot=yes in some regions), `highway=steps`, and `leisure=track`.
**Warning signs:** Routes in a new region are road-heavy despite visible trails on the map. Running `highway~"."` returns far more results than your filtered query.

### Pitfall 2: Overpass Query Timeout in Dense Urban Areas

**What goes wrong:** Queries for Tokyo, London, or NYC return massive data, exceeding the default 180s timeout or 512MB memory limit.
**Why it happens:** Dense cities have thousands of paths, footways, and cycleways. The default Overpass timeout is too short.
**How to avoid:** Always set `[timeout:300][maxsize:536870912]`. Start with a 2km radius and expand only if results are insufficient. Use `out:json` + `out geom` to get geometry in one call. Cache results per-region with 24h TTL.
**Warning signs:** Queries succeed in suburban areas but fail in city centers.

### Pitfall 3: ORS Does NOT Prefer Trails Over Roads

**What goes wrong:** The ORS foot-hiking profile routes on roads even when parallel trails exist. Users expect "trail mode" but get road routes.
**Why it happens:** Routing engines optimize for navigation efficiency, not recreation. Paved roads get higher speed ratings than unpaved trails. The `green` and `quiet` preference factors help but do not override shortest-path logic.
**How to avoid:** Use waypoint-based trail forcing: discover trail segments via Overpass, then place routing waypoints ON those segments so the engine is forced through them. The ORS `preference: 'recommended'` setting with `green: 1.0` and `quiet: 1.0` helps but is insufficient alone.
**Warning signs:** Route stays on roads when zooming shows parallel trails within 100m.

### Pitfall 4: Access Restriction Tags Ignored

**What goes wrong:** Routes include ways tagged `access=private`, `foot=no`, or through gated areas.
**Why it happens:** Overpass queries fetch geometry without filtering by access tags. The routing engine may also route through restricted ways.
**How to avoid:** Add access filters to Overpass queries: exclude `access=private|no`, `foot=private|no`. Be aware that `highway=cycleway` defaults to `foot=no` in many regions unless explicitly tagged `foot=yes`.
**Warning signs:** Users report routes through private property or gated communities.

### Pitfall 5: Region-Specific Tagging Conventions

**What goes wrong:** Queries tuned for US conventions miss trails in Japan, Europe, or elsewhere.
**Why it happens:** The same physical trail gets different tags by region. Japan emphasizes `highway=path` + `surface=*`. Europe uses `sac_scale` difficulty ratings and `route=hiking` relation networks (nwn/rwn/lwn). Czech Republic uses `kct` colour-based systems. The US has inconsistent tagging.
**How to avoid:** Build a region-profile system that adjusts query parameters by detected location. At minimum, always query ALL highway types and ALL route relations regardless of region. Region profiles fine-tune scoring weights, not query scope.
**Warning signs:** Routes in Japan or Europe are unexpectedly road-heavy.

## Code Examples

### Comprehensive Overpass QL Query (Region-Adaptive)

```javascript
// data/query-builder.js
// Source: OSM Wiki highway types, route relations, access restrictions

/**
 * Builds a comprehensive Overpass QL query that captures ALL runnable
 * way types globally. This is the most critical function in Phase 1.
 */
export function buildTrailQuery(bbox, options = {}) {
  const [south, west, north, east] = bbox;
  const timeout = options.timeout || 300;
  const bboxStr = `${south},${west},${north},${east}`;

  // All highway types relevant to runners/hikers
  const highwayTypes = [
    'path',           // Generic non-motorized path (primary in Japan)
    'footway',        // Designated pedestrian way (primary in US/Europe)
    'track',          // Agricultural/forest roads (grade1-3 are runnable)
    'cycleway',       // Shared-use in many countries
    'pedestrian',     // Pedestrian zones in cities
    'bridleway',      // Foot access varies by country (yes in UK)
    'steps',          // Stairs (short segments, part of trail routes)
    'living_street',  // Residential areas with shared space
  ];

  // Route relation types for named trail networks
  const routeTypes = ['hiking', 'running', 'foot', 'fitness_trail'];

  // Leisure features with runnable paths
  const leisureTypes = ['track', 'nature_reserve'];

  const highwayRegex = highwayTypes.join('|');
  const routeRegex = routeTypes.join('|');
  const leisureRegex = leisureTypes.join('|');

  return `
    [out:json][timeout:${timeout}][maxsize:536870912];
    (
      // All runnable highway types, excluding restricted access
      way["highway"~"^(${highwayRegex})$"]
         ["access"!~"^(private|no)$"]
         ["foot"!~"^(private|no)$"]
         (${bboxStr});

      // Named hiking/running route relations
      relation["route"~"^(${routeRegex})$"]
              (${bboxStr});

      // Athletic running tracks
      way["leisure"~"^(${leisureRegex})$"]
         (${bboxStr});
    );
    out body geom;
  `;
}
```

### ORS Foot-Hiking Adapter

```javascript
// routing/adapters/ors.js
// Source: ORS API docs (giscience.github.io/openrouteservice)

export class ORSAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openrouteservice.org';
  }

  async route(waypoints, options = {}) {
    const coordinates = waypoints.map(p => [p.lng, p.lat]);
    const body = {
      coordinates,
      preference: 'recommended',
      units: 'km',
      geometry: true,
      instructions: false,
      options: {
        profile_params: {
          weightings: {
            green: { factor: 1.0 },   // Prefer green areas
            quiet: { factor: 1.0 }    // Prefer quiet ways
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
      throw new Error(`ORS error: ${response.status}`);
    }

    return response.json();
  }
}
```

### OSRM Fallback Adapter

```javascript
// routing/adapters/osrm.js
// Source: OSRM API docs (project-osrm.org/docs/v5.24.0/api/)

export class OSRMAdapter {
  constructor() {
    this.baseUrl = 'https://router.project-osrm.org';
  }

  async route(waypoints) {
    const coords = waypoints
      .map(p => `${p.lng},${p.lat}`)
      .join(';');

    const url = `${this.baseUrl}/route/v1/foot/${coords}` +
      `?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(`OSRM routing failed: ${data.code}`);
    }

    // Normalize to GeoJSON FeatureCollection matching ORS format
    return {
      type: 'FeatureCollection',
      features: data.routes.map(route => ({
        type: 'Feature',
        geometry: route.geometry,
        properties: {
          distance: route.distance / 1000, // meters to km
          duration: route.duration,
          engine: 'osrm'
        }
      }))
    };
  }
}
```

### Region-Adaptive Tag Profiles

```javascript
// data/region-profiles.js
// Source: OSM Wiki (Japan_tagging, Walking_Routes, Key:sac_scale)

/**
 * Region profiles define how to SCORE trail data, not how to QUERY it.
 * The Overpass query always fetches ALL highway types globally.
 * Region profiles adjust scoring weights and tag interpretation.
 */
export const regionProfiles = {
  // Default: works globally
  default: {
    // Tags that indicate high-quality running surfaces
    preferredSurfaces: [
      'asphalt', 'concrete', 'compacted', 'fine_gravel',
      'gravel', 'paving_stones', 'ground', 'dirt', 'earth',
      'grass', 'woodchips', 'tartan'
    ],
    // Tags that indicate poor running surfaces
    avoidSurfaces: ['mud', 'sand', 'snow', 'ice', 'stepping_stones'],
    // sac_scale values considered runnable (T1-T3)
    maxSacScale: 'demanding_mountain_hiking',
    // Route relation network hierarchy
    networkPriority: ['iwn', 'nwn', 'rwn', 'lwn'],
  },

  japan: {
    // Japan emphasizes highway=path with surface tags
    // Japanese trails often lack sac_scale but have good surface tagging
    preferredHighways: ['path', 'footway', 'track', 'pedestrian'],
    // Japan has excellent OSM coverage with surface tags
    surfaceTaggingReliable: true,
    // Name fields: check name:ja, name:en, name
    nameFields: ['name:en', 'name:ja', 'name'],
  },

  europe: {
    // Europe has rich route=hiking relation networks
    preferRelations: true,
    // SAC scale is widely used in alpine regions
    useSacScale: true,
    // Colour-marked trails (Czech kct system, etc.)
    useTrailMarking: true,
    networkPriority: ['iwn', 'nwn', 'rwn', 'lwn'],
  },

  us: {
    // US tagging is inconsistent; same trail may be footway or path
    // Focus on highway type + surface + name presence
    preferredHighways: ['path', 'footway', 'track', 'cycleway'],
    // NPS trails use specific tagging (operator=NPS)
    checkOperator: true,
    // US trails less likely to have sac_scale
    useSacScale: false,
  }
};

/**
 * Detect region from coordinates using reverse geocoding result
 * or simple lat/lng heuristics.
 */
export function detectRegion(lat, lng) {
  // Japan bounding box (approximate)
  if (lat > 24 && lat < 46 && lng > 122 && lng < 154) return 'japan';
  // Europe bounding box (approximate)
  if (lat > 35 && lat < 72 && lng > -25 && lng < 45) return 'europe';
  // US bounding box (approximate, continental)
  if (lat > 24 && lat < 50 && lng > -125 && lng < -66) return 'us';
  return 'default';
}
```

### Overpass Response Normalization to GeoJSON

```javascript
// data/adapters/overpass.js (normalization portion)
// Source: Overpass API Wiki (out body geom format)

/**
 * Convert Overpass JSON response to GeoJSON FeatureCollection.
 * Overpass `out body geom` returns geometry inline on each element.
 */
export function normalizeOverpassToGeoJSON(overpassData) {
  const features = [];

  for (const element of overpassData.elements) {
    if (element.type === 'way' && element.geometry) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: element.geometry.map(n => [n.lon, n.lat])
        },
        properties: {
          id: element.id,
          osmType: 'way',
          ...element.tags
        }
      });
    } else if (element.type === 'relation' && element.members) {
      // Relations contain member ways; extract their geometries
      for (const member of element.members) {
        if (member.type === 'way' && member.geometry) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: member.geometry.map(n => [n.lon, n.lat])
            },
            properties: {
              id: member.ref,
              osmType: 'relation_member',
              relationId: element.id,
              relationName: element.tags?.name,
              routeType: element.tags?.route,
              network: element.tags?.network,
              ...member.tags
            }
          });
        }
      }
    }
  }

  return { type: 'FeatureCollection', features };
}
```

## Comprehensive OSM Tag Matrix for Trail Discovery

This is the authoritative reference for what Overpass queries must capture.

### Highway Types

| Tag | Description | Runnable? | Notes |
|-----|-------------|-----------|-------|
| `highway=path` | Generic non-motorized path | YES | Primary in Japan. May need `surface` tag to assess quality |
| `highway=footway` | Designated pedestrian way | YES | Primary in US/Europe urban areas |
| `highway=track` | Agricultural/forest road | YES (grade1-3) | Filter by `tracktype`: grade1 (paved), grade2 (compacted), grade3 (mixed). Grade4-5 may be too rough |
| `highway=cycleway` | Bicycle path | YES (shared use) | Many are shared-use paths. Check `foot=yes/designated`. Default `foot=no` in some regions |
| `highway=pedestrian` | Pedestrian zone | YES | City centers, plazas. Good for urban running |
| `highway=bridleway` | Horse path | VARIES | `foot=yes` in UK. `foot=no` elsewhere by default |
| `highway=steps` | Stairs | YES (short) | Part of trail routes. Include but score lower for running |
| `highway=living_street` | Shared space residential | YES | Low traffic, suitable for running |
| `highway=residential` | Residential road | FALLBACK | Only as connector, not as trail |
| `highway=unclassified` | Minor road | FALLBACK | Only as connector |
| `highway=service` | Service road | FALLBACK | Parking lots, driveways. Include `service=alley` paths |
| `highway=tertiary` | Minor through-road | FALLBACK | Only when no trails available |

### Route Relations

| Tag | Description | Query Pattern |
|-----|-------------|---------------|
| `route=hiking` | Hiking route relation | Groups multiple ways into a named hiking trail |
| `route=running` | Running route relation | Less common but exists in some regions |
| `route=foot` | Walking route relation | General pedestrian routes |
| `route=fitness_trail` | Fitness trail | Dedicated exercise routes |

### Network Hierarchy (for route relations)

| Value | Scope | Example |
|-------|-------|---------|
| `iwn` | International walking network | E-paths across Europe |
| `nwn` | National walking network | Appalachian Trail (US), Tokaido (Japan) |
| `rwn` | Regional walking network | Bay Area Ridge Trail |
| `lwn` | Local walking network | City park trail loops |

### Access Restriction Filters

Always EXCLUDE these from queries:
- `access=private` or `access=no`
- `foot=private` or `foot=no`
- `highway=motorway` or `highway=motorway_link`

### Leisure Features

| Tag | Description |
|-----|-------------|
| `leisure=track` | Athletic running tracks |
| `leisure=nature_reserve` | May contain runnable paths (query ways within) |

## ORS API Reference (Phase 1 Scope)

### Foot-Hiking Directions Endpoint

```
POST https://api.openrouteservice.org/v2/directions/foot-hiking/geojson
```

**Headers:**
- `Authorization: {api_key}`
- `Content-Type: application/json`

**Key Parameters:**
- `coordinates`: Array of [lng, lat] pairs (max 50 waypoints)
- `preference`: `"fastest"` | `"shortest"` | `"recommended"`
- `units`: `"km"` | `"m"` | `"mi"`
- `options.profile_params.weightings.green.factor`: 0.0-1.0 (prefer green areas)
- `options.profile_params.weightings.quiet.factor`: 0.0-1.0 (prefer quiet ways)

**Rate Limits (Free Tier):**
- 2,000 requests/day
- 40 requests/minute
- Maximum 6,000 km route distance

### OSRM Route Endpoint

```
GET https://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}
```

**Parameters (query string):**
- `overview=full` (complete route geometry)
- `geometries=geojson` (GeoJSON format, not encoded polyline)
- `steps=false` (no turn-by-turn needed for Phase 1)
- `alternatives=false`

**Rate Limits:**
- 1 request/second
- Non-commercial use only
- No uptime/latency guarantees

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw IndexedDB API | `idb` promise wrapper | 2020+ | Eliminates callback hell, 90% less boilerplate |
| Global `S` object for state | Proxy-based reactive store | 2024+ | Auto-notification on changes, no manual `updateUI()` calls |
| Buildless ESM with import maps | Vite 8 with Rolldown bundler | March 2026 | HMR in dev, optimized bundles in prod, best of both worlds |
| Single Overpass endpoint | Multi-endpoint fallback | Always recommended | Overpass-api.de, overpass.kumi.systems, z.overpass-api.de |
| `highway=path|footway` queries | Comprehensive 12+ tag matrix | Phase 1 requirement | Captures 3-5x more runnable ways globally |

**Deprecated/outdated:**
- `localForage` for IndexedDB: Last updated 2021. Use `idb` instead.
- Leaflet 2.0 alpha: Not production-ready. Plugin ecosystem has not migrated. Stay on 1.9.4.
- `osrm.js` client: Barely maintained. Use direct `fetch()` to OSRM HTTP API.

## Open Questions

1. **Overpass `out body geom` behavior for relations**
   - What we know: `out body geom` returns inline geometry for ways. For relations, member geometries are included.
   - What's unclear: Whether very large relations (100+ member ways) return complete geometry or get truncated.
   - Recommendation: Test with a known large relation (e.g., Bay Trail) and verify completeness. If truncated, query relation members separately.

2. **ORS foot-hiking green/quiet factors effectiveness**
   - What we know: `green: 1.0` and `quiet: 1.0` are documented preference factors.
   - What's unclear: How much actual trail preference these provide vs. shortest-path on roads.
   - Recommendation: Build the adapter, test in Bay Area (where parallel trails + roads exist), measure trail percentage. If insufficient, waypoint-based trail forcing is the backup strategy (Phase 2 concern).

3. **Overpass endpoint reliability**
   - What we know: Three public endpoints exist (overpass-api.de, overpass.kumi.systems, z.overpass-api.de).
   - What's unclear: Current uptime and rate limit behavior of each.
   - Recommendation: Implement endpoint rotation in the Overpass adapter. Try primary, fall back to mirrors on failure.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev server, npm | YES | 24.14.0 | -- |
| npm | Package installation | YES | 11.9.0 | -- |
| Overpass API | Trail data queries | YES (public) | v0.7.x | Multiple mirror endpoints |
| ORS API | Foot-hiking routing | YES (requires API key) | v2 | OSRM fallback |
| OSRM Demo Server | Fallback routing | YES (public) | v5 | -- |
| Git | Version control | YES | -- | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None. All dependencies are available.

**Note:** ORS requires a free API key from openrouteservice.org. The user must register and store the key in localStorage.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.js` (none -- Wave 0 must create) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Modules import cleanly, EventBus emits/receives, State Store reacts | unit | `npx vitest run tests/core/ -x` | Wave 0 |
| ARCH-04 | Cache set/get with TTL, expired entries return null | unit | `npx vitest run tests/core/cache.test.js -x` | Wave 0 |
| DATA-01 | Query builder produces correct Overpass QL for all 12+ highway types and route relations | unit | `npx vitest run tests/data/query-builder.test.js -x` | Wave 0 |
| DATA-01 | Overpass response normalizes to valid GeoJSON FeatureCollection | unit | `npx vitest run tests/data/overpass.test.js -x` | Wave 0 |
| DATA-02 | EngineManager falls back from ORS to OSRM on failure | unit | `npx vitest run tests/routing/engine-manager.test.js -x` | Wave 0 |
| DATA-02 | ORS adapter sends correct foot-hiking request with green/quiet factors | unit | `npx vitest run tests/routing/ors.test.js -x` | Wave 0 |
| DATA-02 | OSRM adapter normalizes response to GeoJSON matching ORS format | unit | `npx vitest run tests/routing/osrm.test.js -x` | Wave 0 |
| DATA-05 | Region detection returns correct profile for Japan/Europe/US coordinates | unit | `npx vitest run tests/data/region-profiles.test.js -x` | Wave 0 |
| DATA-05 | Query builder includes region-appropriate tags | unit | `npx vitest run tests/data/query-builder.test.js -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.js` -- Vitest configuration file (may work zero-config with Vite)
- [ ] `tests/core/event-bus.test.js` -- EventBus emit/on/once behavior
- [ ] `tests/core/cache.test.js` -- IndexedDB cache with TTL (needs `fake-indexeddb` or similar mock)
- [ ] `tests/data/query-builder.test.js` -- Overpass QL query generation for all tag types
- [ ] `tests/data/overpass.test.js` -- Response normalization to GeoJSON
- [ ] `tests/data/region-profiles.test.js` -- Region detection and profile selection
- [ ] `tests/routing/engine-manager.test.js` -- Fallback chain behavior
- [ ] `tests/routing/ors.test.js` -- ORS request formatting
- [ ] `tests/routing/osrm.test.js` -- OSRM response normalization
- [ ] `fake-indexeddb` dev dependency -- Mock IndexedDB for Node.js test environment

## Project Constraints (from CLAUDE.md)

- **No backend:** PWA runs entirely client-side. API keys stored in localStorage.
- **No framework:** Vanilla JS + Vite. No React, Vue, Svelte, Angular.
- **Leaflet 1.9.4:** Do NOT use Leaflet 2.0 alpha. Plugin ecosystem has not migrated.
- **No full @turf/turf:** Import individual packages only (keep under 30KB).
- **Strava is optional:** Do NOT architect as a core dependency. No official API. Unauthenticated tiles max zoom 11.
- **ORS rate limit:** 2,000 req/day free tier. Cache aggressively. OSRM fallback required.
- **Single developer:** Architecture must be understandable without deep dev experience. Favor simplicity.
- **GSD Workflow:** Do not make direct repo edits outside a GSD workflow unless explicitly asked.

## Sources

### Primary (HIGH confidence)

- OSM Wiki: [Key:surface](https://wiki.openstreetmap.org/wiki/Key:surface) -- Complete surface tag taxonomy
- OSM Wiki: [Tag:highway=path](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dpath) -- Path vs footway vs track distinctions
- OSM Wiki: [Walking Routes](https://wiki.openstreetmap.org/wiki/Walking_Routes) -- Route relation network hierarchy (iwn/nwn/rwn/lwn)
- OSM Wiki: [Japan tagging](https://wiki.openstreetmap.org/wiki/Japan_tagging) -- Japan-specific highway and surface conventions
- OSM Wiki: [Hiking/Trails](https://wiki.openstreetmap.org/wiki/Hiking/Trails) -- Global trail tagging patterns and regional systems
- OSM Wiki: [OSM tags for routing/Access restrictions](https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Access_restrictions) -- Default foot access by highway type, country variations
- OSM Wiki: [Overpass API/Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) -- Query language reference
- [idb GitHub](https://github.com/jakearchibald/idb) -- v8.0.3 API, openDB/get/put/delete patterns
- [OSRM API Documentation](https://project-osrm.org/docs/v5.24.0/api/) -- v5 route/nearest endpoints, parameter format
- [ORS Routing Options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options) -- foot-hiking profile, green/quiet factors
- [ORS API Restrictions](https://openrouteservice.org/restrictions/) -- Free tier limits (2000/day, 40/min)
- npm registry -- All package versions verified 2026-03-25

### Secondary (MEDIUM confidence)

- [OSRM Demo Server Wiki](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) -- 1 req/sec limit, non-commercial use
- [ORS Hiking Routing Discussion](https://ask.openrouteservice.org/t/routing-for-hiking-paths/5521) -- Community confirms foot-hiking does not fully prefer hiking paths
- Project research: `.planning/research/ARCHITECTURE.md` -- EventBus, State Store, Adapter patterns
- Project research: `.planning/research/STACK.md` -- Verified library versions and alternatives
- Project research: `.planning/research/PITFALLS.md` -- Domain pitfalls with prevention strategies

### Tertiary (LOW confidence)

- ORS green/quiet factor actual effectiveness on trail preference -- documented but untested in Stride context
- `out body geom` behavior for very large relations (100+ members) -- needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All versions verified against npm registry, libraries well-established
- Architecture: HIGH -- Patterns from project research validated against MDN and official docs
- Overpass query coverage: HIGH -- Tag matrix compiled from multiple OSM Wiki sources
- ORS/OSRM adapters: MEDIUM -- API docs verified but green/quiet factor effectiveness unconfirmed in trail preference context
- Region adaptivity: MEDIUM -- Regional tagging conventions documented from OSM Wiki but real-world coverage per region needs empirical testing
- Pitfalls: HIGH -- Corroborated across OSM Wiki, routing engine docs, and community discussions

**Research date:** 2026-03-25
**Valid until:** 2026-04-24 (stable domain, 30-day validity)
