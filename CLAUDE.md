<!-- GSD:project-start source:PROJECT.md -->
## Project

**Stride — AI Running Route Generator**

Stride is a Progressive Web App that generates running, cycling, and hiking routes that feel like they were recommended by a local runner. Users describe what kind of run they want — distance, vibe, surface preferences — and the app builds routes using real trail geometry from multiple data sources, routes them through professional routing engines, and displays them on a Leaflet map with live GPS tracking. The goal is to work flawlessly in any geography on Earth — cities, suburbs, rural areas, mountains.

**Core Value:** Every generated route should feel like a local runner recommended it — hitting the best trails, paths, and scenic spots in any location worldwide, with no dead ends, zig-zags, or unrunnable segments.

### Constraints

- **No backend:** PWA runs entirely client-side. API keys stored in localStorage. Any new data sources must be accessible via client-side API calls or free/freemium endpoints.
- **API rate limits:** ORS free tier is 2000 req/day. Strava and Google Maps APIs have their own limits and may require API keys.
- **OSM data quality:** Varies dramatically by region. Japan has excellent OSM coverage; parts of Africa/South America may be sparse. The multi-source approach must gracefully handle missing data.
- **Single developer:** Patrick builds with Claude. Architecture must be understandable and maintainable without deep dev experience.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
### Geospatial Processing (Client-Side)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@turf/turf** | 7.3.x | Distance calculations, point-in-polygon, bearing, buffer, line operations | The standard client-side geospatial library. Modular (import only what you need via `@turf/distance`, `@turf/bearing`, etc. to reduce bundle size). Works natively with GeoJSON. No server required. Used for scoring trail segments, calculating route distances, detecting overlaps, and building out-and-back geometries. | HIGH |
### Routing Engines (API Clients)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **openrouteservice-js** | 0.4.x | ORS API client for foot-hiking routing + elevation | Official ORS JavaScript client. Supports foot-hiking profile with green/quiet factor preferences. Free tier: 2000 requests/day. Provides turn-by-turn directions, elevation profiles, and isochrones. Primary routing engine for Stride. | MEDIUM |
| **OSRM (direct HTTP)** | v5 API | Fallback routing via fetch() | OSRM has a JS client (`osrm.js`) but it is old and barely maintained. Use direct `fetch()` calls to the OSRM HTTP API (`router.project-osrm.org/route/v1/foot/{coords}`). Demo server limited to 1 req/sec and non-commercial use. Fallback only when ORS quota is exhausted or unavailable. | MEDIUM |
### Data Sources (API Access)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Overpass API** | v0.7.x | Query OSM for trails, paths, parks, water features | Direct HTTP queries via `fetch()`. No client library needed -- Overpass QL is sent as a POST body. The existing prototype already uses this approach. Public endpoints at `overpass-api.de/api/interpreter` and `overpass.kumi.systems/api/interpreter`. | HIGH |
| **Strava Heatmap Tiles** | N/A | Overlay showing where runners actually run | Unauthenticated tiles available at `heatmap-external-a.strava.com/tiles/run/hot/{z}/{x}/{y}.png` up to zoom 11 only. Higher zoom (12-15) requires Strava login cookies that expire every ~2 weeks. No official API for programmatic heatmap access. See Pitfalls. | LOW |
| **Nominatim** | v1 API | Geocoding (place names to coordinates) | Free, no API key, OSM-based. Direct `fetch()` calls. Usage policy: max 1 req/sec, include app user-agent. Already used in prototype. | HIGH |
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
## Installation
# Initialize project
# Core dependencies
# Dev dependencies
### Vite Config Skeleton
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
## What NOT to Use
### Do NOT use a frontend framework (React, Vue, Svelte, Angular)
### Do NOT use Leaflet 2.0-alpha
### Do NOT use Mapbox GL JS
### Do NOT use a backend / serverless functions
### Do NOT install the full @turf/turf package
### Do NOT rely on Strava heatmap as a core data source
## Stack Patterns
### Module Structure (Vanilla JS + Vite)
### API Key Management Pattern
### Reactive State Pattern
## Version Compatibility Matrix
| Package | Min Node | Browser Support | Notes |
|---------|----------|-----------------|-------|
| Vite 8.x | 20.19+ / 22.12+ | Modern browsers (ES2020+) | Rolldown bundler requires recent Node |
| Leaflet 1.9.4 | N/A (browser) | All modern + IE11 (if needed) | No dependencies |
| @turf/* 7.3.x | 18+ | Modern browsers | Uses ES2015+ features |
| idb 8.0.x | 18+ | Chrome, Firefox, Safari, Edge | Targets modern browsers |
| openrouteservice-js 0.4.x | 14+ | Modern browsers | Uses fetch API |
| vite-plugin-pwa 1.2.x | Matches Vite | N/A (build tool) | Requires Vite 5+ |
## Deployment
- Set `base: '/stride/'` in `vite.config.js` (or `'/'` if using `username.github.io` root)
- Deploy `dist/` directory via gh-pages package or GitHub Actions
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
