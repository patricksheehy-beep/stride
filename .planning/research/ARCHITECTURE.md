# Architecture Patterns

**Domain:** Client-side PWA for multi-source running route generation
**Researched:** 2026-03-25

## Recommended Architecture

### Guiding Principles

1. **ES Modules, no bundler.** Native ES modules with import maps, hosted on GitHub Pages. No build step, no Webpack, no framework. Each module is independently cacheable by the service worker.
2. **Event-driven communication.** Components communicate through a central EventBus, not direct imports of each other. This keeps modules replaceable and testable.
3. **Adapter pattern for external APIs.** Every external data source (Overpass, ORS, OSRM, Strava tiles, Nominatim) gets an adapter with a uniform interface. The app never calls fetch() directly for data -- it calls an adapter.
4. **Web Workers for heavy computation.** Trail scoring, segment stitching, and route optimization run off the main thread. The UI stays at 60fps during route generation.
5. **IndexedDB for caching.** Previously fetched trail data, generated routes, and user preferences persist in IndexedDB. Service worker handles tile and static asset caching separately.

### System Overview

```
+------------------------------------------------------------------+
|                        STRIDE PWA                                 |
|                                                                   |
|  +-----------+    +------------+    +-----------+                 |
|  |    UI     |    |   State    |    |  Service  |                 |
|  |  Layer    |<-->|   Store    |<-->|  Worker   |                 |
|  | (Leaflet, |    | (Reactive  |    | (Cache,   |                 |
|  |  panels,  |    |  Proxy)    |    |  offline) |                 |
|  |  controls)|    +-----+------+    +-----------+                 |
|  +-----------+          |                                         |
|                    +----+----+                                    |
|                    | EventBus |                                   |
|                    +----+----+                                    |
|                         |                                         |
|         +---------------+---------------+                         |
|         |               |               |                         |
|  +------+------+ +------+------+ +------+------+                 |
|  | Data Source  | |   Routing   | |   Route     |                 |
|  | Aggregator   | |   Engine    | |   Builder   |                 |
|  |              | |   Manager   | |   + Scorer  |                 |
|  +------+------+ +------+------+ +------+------+                 |
|         |               |               |                         |
|    +----+----+     +----+----+     +----+----+                   |
|    | Adapters|     | Adapters|     |Web Worker|                   |
|    +----+----+     +----+----+     +----------+                   |
|         |               |                                         |
+---------|---------------|----------------------------------------+
          |               |
    +-----+------+  +-----+------+
    | Overpass   |  | ORS API    |
    | Nominatim  |  | OSRM API   |
    | Strava     |  +------------+
    | tiles      |
    +------------+
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **UI Layer** | Map rendering (Leaflet), route display, user input panels, GPS tracking overlay | State Store (reads), EventBus (emits user actions) |
| **State Store** | Single source of truth. Reactive proxy wrapping the current `S` object. Emits change events. | EventBus (emits state changes), UI Layer (notifies), all modules (read) |
| **EventBus** | Decoupled pub/sub message passing between all modules | All components (central hub) |
| **Data Source Aggregator** | Orchestrates queries across multiple data adapters, merges/deduplicates results, resolves conflicts | Data Adapters, EventBus, Route Builder |
| **Routing Engine Manager** | Selects routing engine based on mode (trail/sightseeing/streets), handles fallback from ORS to OSRM, manages rate limits | Routing Adapters, EventBus, Route Builder |
| **Route Builder + Scorer** | Constructs candidate routes from trail segments, scores them, selects best, handles out-and-back/loop geometry | Data Source Aggregator (input), Routing Engine Manager (routing calls), Web Worker (offloaded computation) |
| **Data Adapters** | Uniform interface to Overpass, Nominatim, Strava heatmap tiles, future Google/Apple Maps | External APIs (HTTP), Data Source Aggregator |
| **Routing Adapters** | Uniform interface to ORS (foot-hiking) and OSRM (fallback) | External APIs (HTTP), Routing Engine Manager |
| **Service Worker** | Static asset caching, tile caching, offline page, install prompt | Browser Cache API, IndexedDB |
| **GPS Tracker** | Geolocation watchPosition, accuracy filtering, track recording, distance calculation | EventBus (emits position updates), UI Layer (live marker) |
| **Cache Layer (IndexedDB)** | Persists trail data, generated routes, user preferences, API key storage | All modules that need persistence |

## Recommended Project Structure

```
stride/
  index.html                  # Shell: loads app.js, import map, manifest link
  manifest.json               # PWA manifest
  sw.js                       # Service worker (top-level, required by spec)

  src/
    app.js                    # Entry point: initializes all modules, wires EventBus

    core/
      event-bus.js            # Central pub/sub (CustomEvent-based on EventTarget)
      state.js                # Reactive Proxy-based state store (replaces global S)
      config.js               # API keys from localStorage, app constants, defaults
      cache.js                # IndexedDB wrapper (idb-keyval or thin custom wrapper)

    data/
      aggregator.js           # Orchestrates multi-source data fetching, dedup, merge
      adapters/
        overpass.js            # Overpass QL query builder + fetch
        nominatim.js           # Geocoding adapter
        strava-tiles.js        # Strava heatmap tile URL builder + overlay config
        google-places.js       # (Future) Google Places / POI adapter
      query-builder.js         # Builds Overpass QL queries for different terrain types

    routing/
      engine-manager.js        # Selects engine, manages fallback chain, rate limiting
      adapters/
        ors.js                 # OpenRouteService foot-hiking adapter
        osrm.js                # OSRM fallback adapter
      route-builder.js         # Constructs routes from scored segments
      segment-stitcher.js      # Connects fragmented OSM way segments (300m gap logic)

    scoring/
      scorer.js                # Main scoring orchestrator
      scoring-worker.js        # Web Worker: runs scoring algorithms off main thread
      factors/
        proximity.js           # Distance-from-start scoring factor
        surface.js             # Trail surface quality factor
        popularity.js          # Strava heatmap / usage popularity factor
        scenic.js              # Green areas, waterfront, elevation factor
        continuity.js          # Penalizes fragmented / disconnected segments

    map/
      map-manager.js           # Leaflet map initialization, layer management
      layers.js                # Tile layer definitions (OSM, satellite, Strava overlay)
      route-renderer.js        # Draws routes, waypoints, highlights on map
      gps-tracker.js           # Geolocation API, watchPosition, live tracking
      controls.js              # Custom Leaflet controls (mode selector, etc.)

    ui/
      panels.js                # Input panels (distance, mode, preferences)
      results.js               # Route results display, route list
      settings.js              # API key management, preference UI
      notifications.js         # Toast / status messages

  styles/
    main.css                   # All styles (single file is fine for this scale)

  assets/
    icons/                     # PWA icons (192, 512)
    splash/                    # Splash screens if needed
```

### Why This Structure

- **`core/`** has zero domain knowledge. It is pure infrastructure (events, state, cache, config). Everything else depends on core; core depends on nothing.
- **`data/`** knows how to get geospatial data but not how to route or score it. Each adapter has one job: talk to one API and return normalized GeoJSON.
- **`routing/`** knows how to turn waypoints into routed paths but not how to score or display them.
- **`scoring/`** knows how to rank trail segments but not how to fetch or route them.
- **`map/`** knows how to display things on Leaflet but not how to generate routes.
- **`ui/`** knows how to collect user input and show results but not how routes are generated.

This separation means you can change the scoring algorithm without touching the map code, add a new routing engine without touching the UI, or swap Leaflet for MapLibre GL without touching the data layer.

## Architectural Patterns

### Pattern 1: Reactive State Store (Proxy-based)

Replace the current global `S` object with a Proxy-wrapped store that emits change events.

**What:** A state container using JavaScript Proxy to intercept property changes and notify subscribers.
**When:** Always -- this is the central nervous system of the app.
**Why:** The current global `S` object works but provides no change notification. Components poll or manually call update functions. The Proxy pattern makes it reactive without a framework.

```javascript
// core/state.js
import { eventBus } from './event-bus.js';

const initialState = {
  userLocation: null,
  selectedMode: 'trail',       // 'trail' | 'sightseeing' | 'streets'
  requestedDistance: 5,
  trails: [],                   // fetched trail segments
  scoredTrails: [],             // after scoring
  currentRoute: null,           // generated route GeoJSON
  isGenerating: false,
  gpsTracking: false,
  gpsTrack: [],
};

function createStore(initial) {
  const state = { ...initial };
  return new Proxy(state, {
    set(target, property, value) {
      const oldValue = target[property];
      target[property] = value;
      if (oldValue !== value) {
        eventBus.emit('state:changed', { property, value, oldValue });
        eventBus.emit(`state:${property}`, { value, oldValue });
      }
      return true;
    },
    get(target, property) {
      return target[property];
    }
  });
}

export const store = createStore(initialState);
```

### Pattern 2: EventBus (CustomEvent on EventTarget)

**What:** A lightweight pub/sub system built on the browser's native EventTarget API. Zero dependencies.
**When:** Any time one module needs to notify another without importing it.
**Why:** Avoids the spaghetti of direct cross-module imports. The Data Aggregator does not import the UI; it emits `trails:loaded` and the UI listens.

```javascript
// core/event-bus.js
class EventBus extends EventTarget {
  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler); // returns unsubscribe
  }

  once(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler, { once: true });
  }
}

export const eventBus = new EventBus();
```

### Pattern 3: Adapter Pattern for External APIs

**What:** Every external API gets a module with a uniform interface. The rest of the app never sees raw fetch calls or API-specific response shapes.
**When:** For every external data source and routing engine.
**Why:** APIs change, rate limits differ, response formats vary. The adapter normalizes everything to GeoJSON or a standard internal format.

```javascript
// data/adapters/overpass.js
export class OverpassAdapter {
  constructor(config) {
    this.endpoint = config.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    this.timeout = config.overpassTimeout || 25;
  }

  async fetchTrails(bbox, options = {}) {
    const query = buildOverpassQuery(bbox, options);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!response.ok) throw new OverpassError(response.status);
    const data = await response.json();
    return normalizeToGeoJSON(data);  // Always returns GeoJSON FeatureCollection
  }
}

// routing/adapters/ors.js
export class ORSAdapter {
  constructor(config) {
    this.apiKey = config.orsApiKey;
    this.baseUrl = 'https://api.openrouteservice.org';
  }

  async route(waypoints, profile = 'foot-hiking') {
    const coords = waypoints.map(p => [p.lng, p.lat]);
    const response = await fetch(`${this.baseUrl}/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates: coords })
    });
    if (!response.ok) throw new RoutingError('ORS', response.status);
    return response.json(); // Already GeoJSON
  }
}
```

### Pattern 4: Strategy Pattern for Routing Engine Selection

**What:** The Engine Manager selects a routing engine based on the current mode and falls back if the primary fails.
**When:** Every route generation request.
**Why:** ORS has a 2000 req/day limit and may timeout. OSRM is unlimited but biases toward roads. The strategy pattern makes the fallback chain explicit and extensible.

```javascript
// routing/engine-manager.js
export class EngineManager {
  constructor(adapters, rateLimiter) {
    this.adapters = adapters;  // { ors: ORSAdapter, osrm: OSRMAdapter }
    this.rateLimiter = rateLimiter;
    this.strategies = {
      trail:       ['ors', 'osrm'],    // prefer ORS foot-hiking, fallback OSRM
      sightseeing: ['ors', 'osrm'],
      streets:     ['osrm', 'ors'],    // streets-ok mode: OSRM is fine as primary
    };
  }

  async route(waypoints, mode) {
    const chain = this.strategies[mode] || this.strategies.trail;
    for (const engineKey of chain) {
      try {
        if (!this.rateLimiter.canUse(engineKey)) continue;
        const result = await this.adapters[engineKey].route(waypoints);
        this.rateLimiter.record(engineKey);
        return { route: result, engine: engineKey };
      } catch (err) {
        console.warn(`${engineKey} failed, trying next:`, err.message);
        continue;
      }
    }
    throw new Error('All routing engines failed');
  }
}
```

### Pattern 5: Web Worker for Scoring and Segment Stitching

**What:** Offload CPU-intensive trail scoring and segment stitching to a Web Worker.
**When:** After trail data is fetched, before route display.
**Why:** Scoring hundreds of trail segments with multiple factors (proximity, surface, popularity, continuity) and stitching fragmented OSM ways (the Bay Trail problem: 88 segments, 15km gaps) can block the main thread for seconds. The Web Worker keeps the map interactive.

```javascript
// scoring/scorer.js
export class Scorer {
  constructor() {
    this.worker = new Worker(new URL('./scoring-worker.js', import.meta.url),
                             { type: 'module' });
  }

  score(trails, userLocation, preferences) {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => resolve(e.data);
      this.worker.onerror = (e) => reject(e);
      this.worker.postMessage({ trails, userLocation, preferences });
    });
  }
}

// scoring/scoring-worker.js
import { calculateProximity } from './factors/proximity.js';
import { calculateSurface } from './factors/surface.js';
import { calculateContinuity } from './factors/continuity.js';

self.onmessage = function(e) {
  const { trails, userLocation, preferences } = e.data;
  const scored = trails.map(trail => ({
    ...trail,
    score: weightedScore(trail, userLocation, preferences)
  }));
  scored.sort((a, b) => b.score - a.score);
  self.postMessage(scored);
};
```

### Pattern 6: Data Source Aggregator (Merge + Deduplicate)

**What:** A coordinator that queries multiple data sources in parallel, merges results, and deduplicates overlapping geometry.
**When:** Every route generation request (though results are cached).
**Why:** OSM may miss trails that Strava heatmap shows are popular. Google Places may reveal parks that OSM lacks POI data for. The aggregator unifies these into a single trail dataset.

```javascript
// data/aggregator.js
export class DataAggregator {
  constructor(adapters, cache) {
    this.adapters = adapters;  // { overpass, strava, googlePlaces }
    this.cache = cache;
  }

  async fetchArea(center, radiusKm, options) {
    const bbox = computeBBox(center, radiusKm);
    const cacheKey = `trails:${bbox.join(',')}:${options.mode}`;

    const cached = await this.cache.get(cacheKey);
    if (cached && !isStale(cached)) return cached.data;

    // Parallel fetch from all available sources
    const results = await Promise.allSettled([
      this.adapters.overpass.fetchTrails(bbox, options),
      this.adapters.strava?.getPopularityData(bbox),
      // Future: this.adapters.googlePlaces?.fetchParks(bbox),
    ]);

    const osmTrails = results[0].status === 'fulfilled' ? results[0].value : { features: [] };
    const stravaData = results[1]?.status === 'fulfilled' ? results[1].value : null;

    // Merge: enrich OSM trails with Strava popularity scores
    const merged = enrichWithPopularity(osmTrails, stravaData);

    await this.cache.set(cacheKey, { data: merged, timestamp: Date.now() });
    return merged;
  }
}
```

## Data Flow

### Route Generation Flow (Primary Path)

```
User Input (distance, mode, preferences)
     |
     v
[1] State Store updates (store.requestedDistance = 8)
     |
     v
[2] EventBus emits 'route:generate-requested'
     |
     v
[3] Data Source Aggregator receives event
     |
     +---> [3a] Check IndexedDB cache for this area
     |          (hit? skip to step 4)
     |
     +---> [3b] Parallel fetch:
     |          Overpass: trail/path/cycleway geometry
     |          Strava:   popularity tile overlay data
     |          Nominatim: reverse geocode for area context
     |
     +---> [3c] Merge + deduplicate results
     |          Enrich OSM data with Strava popularity
     |          Cache merged result in IndexedDB
     |
     v
[4] EventBus emits 'data:trails-loaded' with GeoJSON
     |
     v
[5] Route Builder receives trails
     |
     +---> [5a] Post trails to Scoring Web Worker
     |          Worker applies all scoring factors:
     |          - proximity to start
     |          - surface quality
     |          - Strava popularity
     |          - scenic value (waterfront, green)
     |          - segment continuity (penalize fragmented)
     |
     +---> [5b] Worker returns ranked trail segments
     |
     +---> [5c] Segment Stitcher connects top segments
     |          into candidate route (within 300m gap tolerance)
     |
     +---> [5d] Build waypoints for routing engine
     |
     v
[6] Routing Engine Manager receives waypoints
     |
     +---> [6a] Select engine based on mode:
     |          trail -> ORS foot-hiking (prefer trails)
     |          streets -> OSRM (road network fine)
     |
     +---> [6b] Check rate limiter (ORS: 2000/day)
     |
     +---> [6c] Call primary engine
     |          On failure -> fallback to next engine
     |
     +---> [6d] Receive routed GeoJSON
     |
     v
[7] EventBus emits 'route:generated' with route GeoJSON
     |
     v
[8] UI Layer receives route
     |
     +---> [8a] Route Renderer draws polyline on Leaflet map
     +---> [8b] Results panel shows distance, elevation, surface info
     +---> [8c] State Store updated (store.currentRoute = route)
     +---> [8d] Route cached in IndexedDB for offline access
```

### GPS Tracking Flow

```
User taps "Start Tracking"
     |
     v
[1] GPS Tracker calls navigator.geolocation.watchPosition()
     |  (enableHighAccuracy: true)
     |
     v
[2] Each position update:
     +---> Filter by accuracy (reject > 50m)
     +---> Calculate distance from previous point
     +---> EventBus emits 'gps:position' with {lat, lng, accuracy, speed}
     |
     v
[3] Map Manager receives 'gps:position'
     +---> Move position marker
     +---> Update track polyline
     +---> Re-center map if "follow" mode is on
     |
     v
[4] State Store accumulates track
     +---> store.gpsTrack.push(position)
     +---> store.gpsDistance += segmentDistance
```

### State Change Flow

```
Any module calls: store.selectedMode = 'sightseeing'
     |
     v
Proxy setter fires
     |
     +---> EventBus emits 'state:changed' { property: 'selectedMode', value: 'sightseeing' }
     +---> EventBus emits 'state:selectedMode' { value: 'sightseeing' }
     |
     v
Subscribers react:
     +---> UI Layer: updates mode selector highlight
     +---> Routing Engine Manager: notes new default strategy
     +---> (No re-fetch needed until user taps "Generate")
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Module

**What:** Putting route generation, scoring, map rendering, and API calls in a single file (the current index.html situation).
**Why bad:** Every change risks breaking unrelated features. Cannot test scoring without loading Leaflet. Cannot swap routing engine without touching UI code.
**Instead:** One responsibility per module. The Route Builder does not know about Leaflet. The Map Manager does not know about Overpass queries.

### Anti-Pattern 2: Direct Cross-Module Imports for Communication

**What:** The Data Aggregator directly imports and calls methods on the Route Renderer.
**Why bad:** Creates circular dependencies and tight coupling. You cannot change the rendering layer without modifying the data layer.
**Instead:** Use the EventBus. The Aggregator emits `data:trails-loaded`. The Renderer listens for it. Neither knows the other exists.

### Anti-Pattern 3: API Calls Scattered Throughout Code

**What:** Calling `fetch('https://overpass-api.de/...')` directly in the route building logic.
**Why bad:** When Overpass changes its endpoint, rate limit, or response format, you hunt through every file. Cannot mock for testing. Cannot add caching transparently.
**Instead:** All external API calls go through adapters in `data/adapters/` or `routing/adapters/`. The rest of the app receives normalized GeoJSON.

### Anti-Pattern 4: Synchronous Scoring on Main Thread

**What:** Running scoring algorithms for hundreds of trail segments on the main thread.
**Why bad:** Blocks rendering. The Leaflet map freezes. GPS tracking stutters. User thinks app crashed.
**Instead:** Post trail data to a Web Worker. Worker scores and returns results via postMessage. Main thread stays responsive.

### Anti-Pattern 5: localStorage for Complex Data

**What:** Storing trail caches, route history, and large GeoJSON objects in localStorage.
**Why bad:** localStorage is synchronous (blocks main thread), limited to ~5MB, string-only (requires JSON.stringify/parse overhead for every read/write).
**Instead:** Use IndexedDB for structured data and large objects. Keep localStorage only for simple key-value config (API keys, user preferences that are small strings).

### Anti-Pattern 6: Monolithic State Object Without Change Notification

**What:** A global `S` object that modules read and mutate freely, with manual UI update calls.
**Why bad:** No way to know what changed or when. Components get out of sync. You forget to call `updateUI()` after changing state and get stale displays.
**Instead:** Proxy-based reactive store that automatically emits events on every change.

## Integration Points

### External API Integration Matrix

| API | Adapter | Auth | Rate Limit | Fallback | Cache Strategy |
|-----|---------|------|-----------|----------|----------------|
| **Overpass** | `data/adapters/overpass.js` | None | Soft (be polite, ~10k/day reasonable) | Retry with different endpoint (overpass.kumi.systems) | IndexedDB, 24h TTL per bbox |
| **ORS Directions** | `routing/adapters/ors.js` | API key (header) | 2000 req/day (free tier) | OSRM | IndexedDB, cache by waypoint hash |
| **OSRM** | `routing/adapters/osrm.js` | None | No hard limit (public demo server) | None (last resort) | IndexedDB, cache by waypoint hash |
| **Nominatim** | `data/adapters/nominatim.js` | None | 1 req/sec | None (required) | IndexedDB, 7d TTL |
| **Strava Heatmap Tiles** | `data/adapters/strava-tiles.js` | CloudFront cookies (manual, expires ~2 weeks) | Tile server rate limits | Graceful degradation (skip popularity factor) | Service Worker tile cache |
| **Google Places** (future) | `data/adapters/google-places.js` | API key (param) | Depends on plan | Skip (supplementary only) | IndexedDB, 24h TTL |

### Strava Heatmap Integration (Important Constraint)

Strava does NOT offer a public heatmap API. The integration works by:
1. **Low-resolution tiles** are available without auth: `https://heatmap-external-a.strava.com/tiles/run/bluered/{z}/{x}/{y}.png`
2. **High-resolution tiles** require CloudFront cookies extracted from a logged-in strava.com/heatmap session. These expire every ~2 weeks.
3. **For Stride:** Use low-res tiles as a visual overlay on Leaflet (no auth required). For scoring, sample tile pixel intensity at trail segment coordinates to estimate popularity. This is a heuristic, not precise data. The adapter must gracefully degrade if tiles fail to load.
4. **Confidence: LOW.** This approach is fragile. Strava could block it. Build scoring to work without Strava data -- it should be an enhancement, not a requirement.

### Overpass Endpoint Resilience

Multiple public Overpass endpoints exist. The adapter should rotate or fallback:
- `https://overpass-api.de/api/interpreter` (primary)
- `https://overpass.kumi.systems/api/interpreter` (mirror)
- `https://z.overpass-api.de/api/interpreter` (backup)

## Scaling Considerations

| Concern | Current Scale (~1 user) | At 100 users | At 10K users |
|---------|------------------------|--------------|-------------|
| **API rate limits** | Not an issue | ORS 2000/day shared is fine for 1 person; 100 users would exhaust it instantly | Need self-hosted ORS or paid tier |
| **Overpass load** | Fine | Fine with caching | Need own Overpass instance or aggressive caching |
| **Client storage** | IndexedDB has 50MB+ quota | N/A (client-side per user) | N/A (client-side per user) |
| **Bundle size** | No bundler, each module loaded separately | Same | Consider HTTP/2 push or light bundler |
| **Strava tiles** | Works for personal use | Same (each user loads own tiles) | Strava may throttle; need official API partnership |

**Key insight:** Because Stride is client-side only with no backend, "scaling" means each user's browser independently hitting the same public APIs. The bottleneck is API rate limits, not server capacity. Caching aggressively in IndexedDB is the primary scaling strategy.

## Build Order (Dependency Chain)

The modules have clear dependency relationships that dictate build order.

### Phase 1: Foundation (must be first)

Build order within phase: `event-bus.js` -> `state.js` -> `config.js` -> `cache.js`

These have zero domain dependencies. Everything else depends on them. Without the EventBus, no module can communicate. Without the State Store, there is no shared state. Without Config, no API keys are available.

### Phase 2: Data Adapters (depends on Phase 1)

Build order: `overpass.js` -> `nominatim.js` -> `query-builder.js` -> `aggregator.js`

Strava and Google adapters can come later -- they are enrichment, not core. Overpass is the primary data source. Nominatim is needed for geocoding user input.

### Phase 3: Map Layer (depends on Phase 1, can parallel with Phase 2)

Build order: `map-manager.js` -> `layers.js` -> `route-renderer.js` -> `controls.js`

The map can be initialized and display tiles before any route data exists. This can be built in parallel with data adapters.

### Phase 4: Scoring + Route Building (depends on Phase 1 + 2)

Build order: `scoring factors` -> `scoring-worker.js` -> `scorer.js` -> `segment-stitcher.js` -> `route-builder.js`

Needs trail data from Phase 2 to operate. The scoring factors can be built as individual pure functions first, then composed.

### Phase 5: Routing Engine (depends on Phase 1)

Build order: `ors.js` -> `osrm.js` -> `engine-manager.js`

The routing adapters are independent of the data adapters. The Engine Manager composes them with the fallback strategy.

### Phase 6: Integration (depends on Phase 2 + 3 + 4 + 5)

Wire everything together in `app.js`: initialize all modules, subscribe to events, connect the full pipeline from user input to displayed route.

### Phase 7: GPS + PWA (depends on Phase 3)

Build order: `gps-tracker.js` -> `sw.js` -> manifest setup

GPS tracking and PWA features (offline, install) are independent of route generation. They need the map but not the routing pipeline.

### Phase 8: Enrichment Sources

Build order: `strava-tiles.js` -> `popularity.js` scoring factor -> `google-places.js` (future)

These enhance quality but are not required for the core pipeline to function.

### Dependency Graph

```
Phase 1: Foundation
  event-bus  -->  state  -->  config
                               |
                             cache
       |            |           |
       v            v           v
Phase 2: Data    Phase 3: Map   Phase 5: Routing
  overpass         map-mgr        ors
  nominatim        layers         osrm
  aggregator       renderer       engine-mgr
       |            |               |
       v            v               v
Phase 4: Scoring    |               |
  factors           |               |
  worker            |               |
  scorer            |               |
  stitcher          |               |
       |            |               |
       +-----+------+-------+------+
             |               |
             v               v
     Phase 6: Integration (app.js)
             |
             v
     Phase 7: GPS + PWA (sw.js, gps-tracker)
             |
             v
     Phase 8: Enrichment (Strava, Google)
```

## Import Map Configuration

For buildless ES module loading on GitHub Pages:

```html
<!-- index.html -->
<script type="importmap">
{
  "imports": {
    "leaflet": "https://esm.sh/leaflet@1.9.4",
    "idb-keyval": "https://esm.sh/idb-keyval@6.2.1"
  }
}
</script>
<script type="module" src="./src/app.js"></script>
```

This allows using bare specifiers like `import { openDB } from 'idb-keyval'` while keeping local modules as relative imports (`import { eventBus } from '../core/event-bus.js'`).

**Note on Leaflet 2.0:** Leaflet 2.0 alpha was released in May 2025 with full ESM support. However, it is still alpha. Recommend Leaflet 1.9.x via ESM wrapper (esm.sh) for stability, with a plan to migrate to Leaflet 2.0 once it reaches stable release.

## Sources

- [MDN: Progressive Web Apps Best Practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices) - PWA architecture patterns
- [JavaScript Modules in 2025: ESM, Import Maps & Best Practices](https://siddsr0015.medium.com/javascript-modules-in-2025-esm-import-maps-best-practices-7b6996fa8ea3) - ES Module patterns
- [How to Build a PWA without a Build Step](https://goulet.dev/posts/build-a-pwa-without-a-build-step/) - Buildless PWA architecture
- [ES Modules + Importmaps: a modern JS stack](https://www.stevendcoffey.com/blog/esmodules-importmaps-modern-js-stack/) - Import maps for production
- [Event-Driven Architecture in JavaScript Applications: 2025 Deep Dive](https://dev.to/hamzakhan/event-driven-architecture-in-javascript-applications-a-2025-deep-dive-4b8g) - EventBus patterns
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - Proxy-based state management
- [CSS-Tricks: Build a State Management System with Vanilla JavaScript](https://css-tricks.com/build-a-state-management-system-with-vanilla-javascript/) - Observer + Proxy pattern
- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) - Web Worker API
- [MDN: Geolocation watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) - GPS tracking API
- [Leaflet 2.0 Alpha Released](https://leafletjs.com/2025/05/18/leaflet-2.0.0-alpha.html) - Leaflet ESM support
- [Leaflet Plugins Directory](https://leafletjs.com/plugins.html) - Layer control patterns
- [OpenRouteService JavaScript Client](https://github.com/GIScience/openrouteservice-js) - ORS adapter patterns
- [OSRM API Documentation](https://project-osrm.org/docs/v5.24.0/api/) - OSRM REST API
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) - Overpass query patterns
- [Strava Global Heatmap](https://www.strava.com/heatmap) - Tile format documentation
- [Strava Community: Global Heatmap API](https://communityhub.strava.com/developers-api-7/global-heatmap-api-2100) - Confirms no public API
- [Leaflet.TileLayer.PouchDBCached](https://github.com/MazeMap/Leaflet.TileLayer.PouchDBCached) - Offline tile caching pattern
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Client-side structured storage
- [Resilience Patterns: Retry, Fallback, Circuit Breaker](https://www.codecentric.de/en/knowledge-hub/blog/resilience-design-patterns-retry-fallback-timeout-circuit-breaker) - API resilience patterns
- [Beyond SPAs - Chrome Developers](https://developer.chrome.com/blog/beyond-spa) - Alternative PWA architectures
