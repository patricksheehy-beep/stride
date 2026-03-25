# Technology Stack

**Project:** Stride -- AI Running Route Generator PWA
**Researched:** 2026-03-25
**Overall Confidence:** MEDIUM-HIGH (core libraries verified via official sources; some version dates approximate)

---

## Recommended Stack

### Build System & Development

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vite** | 8.x | Build tool, dev server, module bundler | Ships with Rolldown (Rust-based bundler) for 10-30x faster builds. Native ESM in dev, optimized bundles in production. First-class vanilla JS support via `npm create vite@latest -- --template vanilla`. Deploys to GitHub Pages trivially. The dominant build tool in 2026. | HIGH |
| **vite-plugin-pwa** | 1.2.x | PWA scaffolding (manifest, service worker, icons) | Zero-config PWA generation for Vite. Framework-agnostic. Generates service worker via Workbox under the hood. Handles manifest.json, icon generation, and offline fallback. Used by 54% of PWA sites via its Workbox dependency. | HIGH |
| **Workbox** | 7.x | Service worker caching strategies | Bundled inside vite-plugin-pwa. Provides stale-while-revalidate for API responses, cache-first for map tiles, and offline fallbacks. Do not install separately -- vite-plugin-pwa manages it. | HIGH |

### Map Rendering

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Leaflet** | 1.9.4 | Interactive map rendering, route display, GPS tracking | The existing prototype already uses Leaflet. 1.9.4 is the current stable release (May 2025). Zero npm dependencies (great for PWA bundle size). Massive plugin ecosystem. Raster tile-based, which is simpler and uses less memory than WebGL alternatives. For a route generation app that displays polylines and markers (not rendering 50k+ features), Leaflet's performance is more than adequate. | HIGH |

**Why NOT Leaflet 2.0:** Leaflet 2.0 is alpha only (August 2025). Breaking changes are substantial (ESM-only, no global `L`, factory methods removed). Plugin ecosystem has not migrated. Do NOT adopt 2.0 for production. Stay on 1.9.4 until 2.0 reaches stable and plugins catch up.

**Why NOT MapLibre GL JS:** MapLibre excels at rendering large vector datasets (50k+ features) with WebGL. Stride renders route polylines, trail segments, and markers -- well under thresholds where WebGL matters. MapLibre requires vector tile sources (more complex hosting), has higher resource consumption on mobile, and the existing prototype is built on Leaflet. The migration cost brings no benefit for this use case.

### Geospatial Processing (Client-Side)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@turf/turf** | 7.3.x | Distance calculations, point-in-polygon, bearing, buffer, line operations | The standard client-side geospatial library. Modular (import only what you need via `@turf/distance`, `@turf/bearing`, etc. to reduce bundle size). Works natively with GeoJSON. No server required. Used for scoring trail segments, calculating route distances, detecting overlaps, and building out-and-back geometries. | HIGH |

**Import strategy:** Use individual packages (`@turf/distance`, `@turf/bearing`, `@turf/line-slice`, `@turf/boolean-point-in-polygon`) rather than the full `@turf/turf` bundle. Full bundle is ~300KB; cherry-picking keeps it under 30KB for Stride's needs.

### Routing Engines (API Clients)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **openrouteservice-js** | 0.4.x | ORS API client for foot-hiking routing + elevation | Official ORS JavaScript client. Supports foot-hiking profile with green/quiet factor preferences. Free tier: 2000 requests/day. Provides turn-by-turn directions, elevation profiles, and isochrones. Primary routing engine for Stride. | MEDIUM |
| **OSRM (direct HTTP)** | v5 API | Fallback routing via fetch() | OSRM has a JS client (`osrm.js`) but it is old and barely maintained. Use direct `fetch()` calls to the OSRM HTTP API (`router.project-osrm.org/route/v1/foot/{coords}`). Demo server limited to 1 req/sec and non-commercial use. Fallback only when ORS quota is exhausted or unavailable. | MEDIUM |

**Why direct fetch over osrm.js:** The OSRM JS client is stale and adds unnecessary dependency weight. The API is simple REST -- a `fetch()` wrapper in your own code is cleaner, smaller, and maintainable.

### Data Sources (API Access)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Overpass API** | v0.7.x | Query OSM for trails, paths, parks, water features | Direct HTTP queries via `fetch()`. No client library needed -- Overpass QL is sent as a POST body. The existing prototype already uses this approach. Public endpoints at `overpass-api.de/api/interpreter` and `overpass.kumi.systems/api/interpreter`. | HIGH |
| **Strava Heatmap Tiles** | N/A | Overlay showing where runners actually run | Unauthenticated tiles available at `heatmap-external-a.strava.com/tiles/run/hot/{z}/{x}/{y}.png` up to zoom 11 only. Higher zoom (12-15) requires Strava login cookies that expire every ~2 weeks. No official API for programmatic heatmap access. See Pitfalls. | LOW |
| **Nominatim** | v1 API | Geocoding (place names to coordinates) | Free, no API key, OSM-based. Direct `fetch()` calls. Usage policy: max 1 req/sec, include app user-agent. Already used in prototype. | HIGH |

**Why no dedicated Overpass client library:** The available libraries (`overpass-frontend`, `query-overpass`) add abstraction without meaningful benefit. Stride already builds raw Overpass QL queries. A thin `fetch()` wrapper in project code is simpler, more maintainable for a solo developer, and avoids a dependency that may go unmaintained.

**Strava heatmap reality check:** There is no official Strava heatmap API. The unauthenticated tiles (zoom <= 11) are too low-resolution for route-level decisions. Authenticated tiles require browser cookies from a logged-in session that expire biweekly. This makes Strava heatmaps a "nice-to-have overlay" rather than a reliable data source for scoring. Plan architecture so Strava is an optional layer, not a dependency.

### Polyline & Data Encoding

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@mapbox/polyline** | 1.2.x | Encode/decode Google-format polylines from routing APIs | De facto standard for polyline encoding in JS. Both ORS and OSRM return encoded polylines. Tiny library (~2KB). | HIGH |

### Offline Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **idb** | 8.0.x | IndexedDB wrapper for caching routes, tiles, trail data | Created by Jake Archibald (Google Chrome team). 1.2KB brotli'd. Promise-based API over raw IndexedDB. Use for caching scored trail segments, generated routes, and Overpass responses to reduce API calls. Essential for offline-first PWA. | HIGH |

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vanilla JS (Proxy-based reactive store)** | N/A | App state: current route, user preferences, map position, UI state | No framework means no Redux/Zustand/Pinia. Modern `Proxy` API enables reactive state with auto-UI-updates in ~50 lines of code. Simpler to understand and debug than any library. Structured cloning (`structuredClone()`) for immutable state snapshots. Custom `EventTarget` for cross-module communication. | MEDIUM |

**Pattern:** A single `store.js` module exporting a Proxy-wrapped state object. Modules subscribe to changes via `addEventListener`. This is the 2025/2026 pattern for vanilla JS apps -- lightweight, zero-dependency, and fully debuggable.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@mapbox/polyline** | 1.2.x | Polyline encoding/decoding | Every routing API response |
| **Individual @turf/* packages** | 7.3.x | Geo calculations (distance, bearing, line ops) | Route scoring, distance calculation, segment stitching |
| **idb** | 8.0.x | IndexedDB with promises | Caching routes, API responses, user preferences |

### Development Tools

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **ESLint** | 9.x | Code linting | Flat config format (`eslint.config.js`) is the modern standard. Use `@eslint/js` recommended ruleset for vanilla JS. | HIGH |
| **Prettier** | 3.x | Code formatting | Pair with `eslint-config-prettier` to avoid conflicts. | HIGH |
| **vitest** | 3.x | Unit testing | Vite-native test runner. Zero-config for Vite projects. Test Turf.js calculations, scoring algorithms, and state management without browser. | HIGH |
| **gh-pages** | 6.x | Deployment to GitHub Pages | `npm run deploy` pushes `dist/` to gh-pages branch. Simple, proven workflow. | HIGH |

---

## Installation

```bash
# Initialize project
npm create vite@latest stride -- --template vanilla
cd stride

# Core dependencies
npm install leaflet @turf/distance @turf/bearing @turf/line-slice @turf/boolean-point-in-polygon @turf/helpers @turf/length @turf/nearest-point-on-line @turf/buffer openrouteservice-js @mapbox/polyline idb

# Dev dependencies
npm install -D vite-plugin-pwa eslint @eslint/js prettier eslint-config-prettier vitest gh-pages
```

### Vite Config Skeleton

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/stride/',  // Match GitHub Pages repo name
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Cache map tiles with cache-first strategy
            urlPattern: /^https:\/\/.*tile.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },
          {
            // Cache API responses with stale-while-revalidate
            urlPattern: /^https:\/\/(api\.openrouteservice|overpass-api|router\.project-osrm)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-responses',
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }
            }
          }
        ]
      },
      manifest: {
        name: 'Stride - AI Running Route Generator',
        short_name: 'Stride',
        theme_color: '#2d5016',
        display: 'standalone'
      }
    })
  ]
});
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **Build tool** | Vite 8 | Webpack 5 | Webpack is slower (no Rust bundler), more complex config, declining mindshare. Vite is the 2026 standard. |
| **Build tool** | Vite 8 | Parcel 2 | Parcel has weaker PWA plugin ecosystem and less community support for vanilla JS. |
| **Map rendering** | Leaflet 1.9.4 | MapLibre GL JS | WebGL overhead unjustified for Stride's feature count. Vector tile hosting is complex. Leaflet plugin ecosystem is larger. Prototype already uses Leaflet. |
| **Map rendering** | Leaflet 1.9.4 | OpenLayers | Over-engineered for this use case. Steeper learning curve. Larger bundle size. |
| **Geospatial** | Turf.js 7.x | JSTS | JSTS is a port of Java Topology Suite -- heavier, less idiomatic JS, smaller community. Turf covers all of Stride's needs. |
| **State management** | Vanilla Proxy store | Zustand / Jotai | Require React. Not applicable to vanilla JS PWA. |
| **State management** | Vanilla Proxy store | VanJS | Adds a micro-framework dependency. Proxy pattern achieves the same with zero deps. |
| **Framework** | None (vanilla JS + Vite) | React / Vue / Svelte | Massive overhead for what is fundamentally a map + UI chrome app. The core complexity is in geospatial algorithms and API orchestration, not UI state. Frameworks add build complexity, learning curve, and bundle size for no benefit here. Patrick has no dev experience -- vanilla JS + ESM is the most debuggable, least magical option. |
| **Routing client** | Direct fetch() for OSRM | osrm.js | osrm.js is barely maintained, uses old module patterns, and wraps a simple REST API that needs no abstraction. |
| **Overpass client** | Direct fetch() | overpass-frontend | Adds caching abstraction Stride doesn't need (we cache via IndexedDB ourselves). Library is niche and may go unmaintained. |
| **Offline storage** | idb | localForage | localForage hasn't been updated since 2021. idb is actively maintained by Jake Archibald and follows modern patterns. |
| **Testing** | Vitest | Jest | Vitest is Vite-native, shares config, faster, and supports ESM natively. Jest requires additional config for ESM. |

---

## What NOT to Use

### Do NOT use a frontend framework (React, Vue, Svelte, Angular)

**Why it's tempting:** Frameworks provide component models, state management, and large ecosystems.

**Why it's wrong for Stride:** The app's complexity is in geospatial algorithms, API orchestration, and scoring -- not UI state management. The UI is: a map (Leaflet handles this), some input controls, and a route results panel. Adding React would mean: JSX compilation, virtual DOM overhead, a component lifecycle to learn, and React-specific Leaflet wrappers (`react-leaflet`) that add abstraction between you and the map API. For a solo developer building with Claude, the fewer abstractions the better.

### Do NOT use Leaflet 2.0-alpha

**Why it's tempting:** Modern ESM imports, cleaner API.

**Why it's wrong now:** Alpha quality. Plugin ecosystem (Leaflet.Routing.Machine, leaflet-gpx, Leaflet.markercluster) has NOT migrated. Breaking changes mean every Stack Overflow answer and Claude training example uses 1.x patterns. Wait for stable 2.0 release and plugin migration (likely late 2026 at earliest).

### Do NOT use Mapbox GL JS

**Why it's tempting:** Beautiful vector maps, 3D terrain.

**Why it's wrong:** Requires Mapbox access token with usage-based pricing. Not open source since v2. For a free PWA with no backend, proprietary map SDKs create a cost and vendor-lock risk.

### Do NOT use a backend / serverless functions

**Why it's tempting:** Could proxy API keys, handle Strava auth, aggregate data.

**Why it's wrong:** PROJECT.md explicitly constrains to client-side only. API keys in localStorage is the pattern. Adding a backend adds deployment complexity, ongoing costs, and maintenance burden for a solo developer.

### Do NOT install the full @turf/turf package

**Why it's tempting:** One import gets everything.

**Why it's wrong:** Full bundle is ~300KB. Stride needs ~8 functions. Import individually: `@turf/distance`, `@turf/bearing`, `@turf/length`, `@turf/line-slice`, `@turf/nearest-point-on-line`, `@turf/boolean-point-in-polygon`, `@turf/buffer`, `@turf/helpers`. Keep the bundle under 30KB for these.

### Do NOT rely on Strava heatmap as a core data source

**Why it's tempting:** Shows exactly where runners run.

**Why it's wrong as a dependency:** No official API. Unauthenticated tiles max zoom 11 (city-level, not route-level). Authenticated tiles require browser cookies that expire every ~2 weeks with no programmatic refresh. Strava actively restricts third-party heatmap use. Architecture it as an optional visual overlay, never as a scoring input.

---

## Stack Patterns

### Module Structure (Vanilla JS + Vite)

```
src/
  main.js                  # Entry point, initializes app
  config.js                # API keys, constants, feature flags
  store.js                 # Proxy-based reactive state
  map/
    map.js                 # Leaflet map initialization and control
    layers.js              # Tile layers, overlays (OSM, Strava heatmap)
    markers.js             # User location, waypoints, POI markers
  routing/
    router.js              # Routing orchestrator (picks ORS vs OSRM)
    ors-client.js           # ORS API wrapper
    osrm-client.js          # OSRM direct fetch wrapper
    route-builder.js        # Assemble waypoints into routable segments
  data/
    overpass.js             # Overpass QL query builder and fetcher
    trail-scorer.js         # Score trail segments by quality signals
    segment-connector.js    # Stitch fragmented trail segments
    geocoder.js             # Nominatim geocoding wrapper
  scoring/
    score-engine.js         # Aggregate scoring from multiple signals
    weights.js              # Configurable scoring weights per mode
  cache/
    cache-manager.js        # IndexedDB via idb for routes, API responses
  ui/
    controls.js             # Distance slider, mode selector, preferences
    results-panel.js        # Route display, alternatives
    gps-tracker.js          # Live GPS tracking during run
  sw.js                     # Service worker (generated by vite-plugin-pwa)
```

### API Key Management Pattern

```javascript
// config.js -- keys stored in localStorage, prompted on first use
export function getApiKey(service) {
  const key = localStorage.getItem(`stride_api_${service}`);
  if (!key) {
    // Trigger UI prompt for key entry
    return null;
  }
  return key;
}
```

### Reactive State Pattern

```javascript
// store.js -- Proxy-based reactive store
const state = {
  currentRoute: null,
  userLocation: null,
  routeMode: 'trail',  // 'trail' | 'sightseeing' | 'streets'
  requestedDistance: 5,  // km
  trails: [],
  isLoading: false,
};

const listeners = new Set();

export const store = new Proxy(state, {
  set(target, prop, value) {
    target[prop] = value;
    listeners.forEach(fn => fn(prop, value));
    return true;
  }
});

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

---

## Version Compatibility Matrix

| Package | Min Node | Browser Support | Notes |
|---------|----------|-----------------|-------|
| Vite 8.x | 20.19+ / 22.12+ | Modern browsers (ES2020+) | Rolldown bundler requires recent Node |
| Leaflet 1.9.4 | N/A (browser) | All modern + IE11 (if needed) | No dependencies |
| @turf/* 7.3.x | 18+ | Modern browsers | Uses ES2015+ features |
| idb 8.0.x | 18+ | Chrome, Firefox, Safari, Edge | Targets modern browsers |
| openrouteservice-js 0.4.x | 14+ | Modern browsers | Uses fetch API |
| vite-plugin-pwa 1.2.x | Matches Vite | N/A (build tool) | Requires Vite 5+ |

**Node version recommendation:** Use Node 22.x LTS. This satisfies all dependencies and provides native ESM support.

---

## Deployment

**Target:** GitHub Pages (already used by prototype)

```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "test": "vitest",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

**GitHub Pages config:**
- Set `base: '/stride/'` in `vite.config.js` (or `'/'` if using `username.github.io` root)
- Deploy `dist/` directory via gh-pages package or GitHub Actions

---

## Sources

### Verified (HIGH confidence)
- [Leaflet 1.9.4 Release](https://github.com/Leaflet/Leaflet/releases) -- stable release May 2025
- [Leaflet 2.0 Alpha Announcement](https://leafletjs.com/2025/05/18/leaflet-2.0.0-alpha.html) -- breaking changes documented
- [Vite 8 Announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown integration, March 2026
- [Vite Releases](https://vite.dev/releases) -- v8.0.2 current
- [vite-plugin-pwa Documentation](https://vite-pwa-org.netlify.app/) -- v1.2.x, framework-agnostic
- [Turf.js GitHub](https://github.com/Turfjs/turf) -- v7.3.4 current
- [Turf.js Documentation](https://turfjs.org/) -- modular import guide
- [idb GitHub](https://github.com/jakearchibald/idb) -- v8.0.3, actively maintained
- [Workbox Documentation](https://developer.chrome.com/docs/workbox) -- v7, Google-maintained
- [OpenRouteService JS Client](https://github.com/GIScience/openrouteservice-js) -- v0.4.1
- [OSRM API Documentation](https://project-osrm.org/docs/v5.24.0/api/) -- v5 HTTP API
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) -- query reference
- [Nominatim Documentation](https://nominatim.org/) -- usage policy
- [Vite Static Deploy Guide](https://vite.dev/guide/static-deploy) -- GitHub Pages instructions

### Partially Verified (MEDIUM confidence)
- [MapLibre vs Leaflet Comparison](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/) -- performance analysis
- [Map Libraries Statistics](https://www.geoapify.com/map-libraries-comparison-leaflet-vs-maplibre-gl-vs-openlayers-trends-and-statistics/) -- download trends
- [@mapbox/polyline npm](https://www.npmjs.com/package/@mapbox/polyline) -- v1.2.x
- [openrouteservice-js npm](https://www.npmjs.com/package/openrouteservice-js) -- v0.4.1

### Unverified / LOW confidence
- [Strava Heatmap Tile Access](https://wiki.openstreetmap.org/wiki/Strava) -- unauthenticated tile URLs, expiry behavior
- [Strava Heatmap Community Discussion](https://communityhub.strava.com/strava-features-chat-5/make-high-resolution-heatmap-tiles-externally-available-again-11061) -- no official API confirmed
- Vanilla JS Proxy state management pattern -- multiple Medium articles, no authoritative source (pattern is straightforward ES6, low risk)
