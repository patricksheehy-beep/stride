# Project Research Summary

**Project:** Stride -- AI Running Route Generator PWA
**Domain:** Client-side geospatial route generation (running/hiking/cycling)
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

Stride is a client-side PWA that generates running routes which feel like a local runner recommended them. The research confirms this is a tractable problem with proven patterns: Trail Router demonstrated that OSM data + routing engines + green-space scoring can produce quality recreational routes, and recent academic work (PathGPT, LLMAP) validates LLM-based natural language route generation as feasible. The recommended technical approach is Vanilla JS + ES Modules + Vite 8, Leaflet 1.9.4 for maps, Turf.js for geospatial math, ORS/OSRM for routing, and Overpass for trail discovery. No frontend framework is needed -- the complexity lives in algorithms and API orchestration, not UI state. The architecture should use an EventBus for decoupled communication, adapter pattern for all external APIs, Web Workers for the scoring pipeline, and IndexedDB for caching.

The single most important finding across all research is that **Strava heatmap data is not freely available via API**. The project plan lists Strava as a target data source for runner popularity, but Strava's 2024 API agreement update prohibits use in AI models and third-party route generation, and heatmap tiles above zoom 11 require authenticated session cookies that expire biweekly. This means the "local knowledge" feel must come from creative use of OSM signals -- route relations, land-use polygons (parks, forests, water), trail naming, surface tags, and highway classification -- rather than proprietary crowd activity data. This is achievable: Trail Router proved that green-space scoring alone produces routes runners love. Stride can surpass Trail Router by adding LLM-interpreted natural language input, multi-factor scoring, and route quality explanations -- a combination no competitor offers.

The key risks are: (1) routing engines bias toward roads over trails, requiring waypoint-based trail forcing rather than naive start-to-end routing; (2) the Bay Area locality bias will cause silent quality degradation worldwide unless a golden test set of 20+ global locations is defined and automated from the start; (3) distance accuracy compounds errors from haversine estimation, routing detours, and elevation, requiring iterative refinement loops; and (4) ORS free tier (2,000 req/day) creates a hard scaling ceiling around 400 route generations per day. Each of these has proven mitigation strategies documented in the research.

## Key Findings

### Recommended Stack

The stack is deliberately minimal: no framework, no backend, no build-time magic. Vite 8 with Rolldown provides fast builds and native ESM dev experience. Leaflet 1.9.4 (not 2.0 alpha) handles map rendering with zero dependencies. Individual Turf.js packages (not the full bundle) handle geospatial math at under 30KB. The `idb` library wraps IndexedDB for offline storage. All external APIs use direct `fetch()` or thin adapter wrappers rather than heavy client libraries.

**Core technologies:**
- **Vite 8.x**: Build tool and dev server -- Rust-based Rolldown bundler, first-class vanilla JS support, trivial GitHub Pages deployment
- **Leaflet 1.9.4**: Map rendering -- zero dependencies, massive plugin ecosystem, adequate for route polylines and markers (WebGL not needed)
- **Turf.js 7.3.x** (individual packages): Geospatial calculations -- distance, bearing, line operations, point-in-polygon for scoring
- **ORS + OSRM**: Routing engines -- ORS foot-hiking as primary (trail-aware), OSRM as fallback (no rate limit), both via direct fetch
- **Overpass API**: Trail discovery -- raw Overpass QL queries via fetch, no client library needed
- **idb 8.0.x**: Offline storage -- Promise-based IndexedDB wrapper for caching routes, API responses, and preferences
- **vite-plugin-pwa**: PWA scaffolding -- service worker generation via Workbox, manifest handling, offline support

**Critical version notes:** Do NOT use Leaflet 2.0 (alpha, plugin ecosystem not migrated). Do NOT install full `@turf/turf` bundle (300KB vs 30KB for cherry-picked). Use Node 22.x LTS.

### Expected Features

The competitive landscape shows a clear opportunity: no competitor offers natural language route description, no competitor explains why a route was chosen, and popularity data is siloed behind proprietary walls (Strava, Garmin). Route quality complaints are rampant across competitors -- Strava users report dead ends, road-heavy routes, and unsafe segments. The bar for "good" is surprisingly low.

**Must have (table stakes):**
- Loop/round-trip route generation that produces intentional-feeling routes (not zig-zags)
- Distance accuracy within 10% of requested distance
- Map display with route overlay, elevation profile, starting point selection
- GPX export (enables real-world use on GPS watches)
- Multiple route options (2-3 candidates, not take-it-or-leave-it)
- Mobile-responsive design (most route planning happens on phones)

**Should have (differentiators):**
- Natural language route description ("scenic waterfront 5-mile trail run") -- this IS Stride's identity, no competitor does it
- Route quality explanations ("follows Bay Trail waterfront, avoids Highway 101 crossing") -- builds trust, no competitor does it
- Green space preference routing (Trail Router's proven approach: 30m buffer intersection with parks/forests/water)
- Multi-source data fusion (OSM geometry + land-use scoring + route relations + surface tags)

**Defer (v2+):**
- Popularity-weighted routing (requires solving the data source problem -- Strava is restricted)
- Offline map tile pre-download (significant engineering scope)
- Turn-by-turn voice navigation (RunGo/Footpath own this space)
- POI integration, safety-aware routing, trail condition reports
- Social features, user accounts, payments (explicitly out of scope per PROJECT.md)

### Architecture Approach

The architecture is a modular event-driven system with clear separation: core infrastructure (EventBus, state store, config, cache) depends on nothing; data adapters normalize external APIs to GeoJSON; routing adapters abstract engine selection with fallback chains; scoring runs off-thread in Web Workers; and the UI layer (Leaflet + panels) subscribes to state changes via the EventBus. Every external API call goes through an adapter -- the app never calls `fetch()` directly for data. This separation means you can swap a routing engine without touching UI code, change the scoring algorithm without touching the map, or add a new data source without modifying the route builder.

**Major components:**
1. **Core Layer** (EventBus, State Store, Config, Cache) -- infrastructure with zero domain knowledge; everything depends on it
2. **Data Source Aggregator + Adapters** (Overpass, Nominatim, future sources) -- fetches and normalizes trail data to GeoJSON
3. **Routing Engine Manager + Adapters** (ORS, OSRM) -- selects engine by mode, handles fallback chain, manages rate limits
4. **Route Builder + Scorer** (scoring factors, Web Worker, segment stitcher) -- constructs candidate routes, scores them, selects best
5. **UI Layer** (Leaflet map manager, route renderer, input panels, GPS tracker) -- display and interaction only
6. **Service Worker** (Workbox via vite-plugin-pwa) -- static asset caching, tile caching, offline support

### Critical Pitfalls

1. **Routing engines bias toward roads over trails** -- Do NOT send start/end and expect the router to find trails. Pre-select trail waypoints from scored OSM data, then route between consecutive waypoint pairs to force the router through trails. Consider Valhalla (dynamic runtime costing) as a future upgrade.

2. **Strava heatmap data is not freely available** -- Remove Strava as a primary data source. Build "local knowledge" from OSM signals: route relations (`route=running/hiking`), land-use polygons (parks, forests, water), trail naming, surface tags, and highway classification. Strava is an optional visual overlay at best, never a scoring dependency.

3. **"Works in Bay Area" locality bias** -- Define a golden test set of 20+ locations across 6 continents before writing algorithms. Make ALL thresholds configurable (gap tolerance, search radius, scoring weights). Test after every algorithm change. This is the most insidious pitfall because everything appears to work until someone tries it in Kyoto or the Alps.

4. **Incomplete Overpass tag coverage** -- OSM has 12+ highway types relevant to runners plus route relations, leisure tracks, and park paths. The prototype likely queries a subset. Build a comprehensive tag matrix and test against diverse cities before finalizing.

5. **Distance accuracy compounds errors** -- Haversine underestimates by 10-40% depending on sinuosity. Always compute distance from actual routed geometry, not waypoint-to-waypoint estimates. Implement iterative refinement with region-specific circuity factors (urban: 1.2, mountain: 1.6-2.0). Target 5% accuracy.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Data Layer
**Rationale:** Everything downstream depends on having clean, complete trail data and a modular architecture. The current monolithic index.html cannot support multi-source complexity. The research unanimously identifies data quality as the foundation -- scoring, routing, and display are only as good as the trail data they operate on.
**Delivers:** Modular codebase (core infrastructure, data adapters, Overpass query builder), comprehensive OSM tag coverage, IndexedDB caching, basic map display, golden test set definition.
**Addresses:** Map display (table stakes), starting point selection, current location detection.
**Avoids:** Pitfall #1 (incomplete tags), #2 (fragmentation -- discovery side), #6 (Strava dependency -- architecture it out now), #8 (API key strategy), #13 (query timeouts), #14 (access restrictions).

### Phase 2: Routing and Scoring Engine
**Rationale:** With clean trail data available, the next step is turning it into actual runnable routes. The routing engine integration and scoring formula are the core algorithmic challenges. Waypoint-based trail forcing (the key insight from Pitfall #3) requires both the trail data from Phase 1 and the routing adapters built here.
**Delivers:** ORS/OSRM routing adapters with fallback chain, multi-factor scoring formula in Web Worker, segment stitching, loop/out-and-back route construction, iterative distance refinement, multiple route candidates.
**Addresses:** Loop generation (P0), distance accuracy (P0), elevation profile, multiple route options (P0).
**Avoids:** Pitfall #3 (road bias via waypoint forcing), #4 (proximity-over-quality via multi-factor scoring), #7 (distance accuracy via iterative refinement), #10 (ugly loop shapes via geographic waypoints).

### Phase 3: Natural Language Input and Route Explanations
**Rationale:** Natural language input is Stride's core differentiator -- no competitor offers it. But it depends on having a working scoring/routing pipeline to translate "scenic waterfront run" into adjusted scoring weights and waypoint selection. Route explanations are the trust-building counterpart: showing users WHY a route was chosen.
**Delivers:** LLM integration for parsing natural language into scoring weights and waypoint preferences, route quality explanations, refined vibe-based modes beyond Trail/Sightseeing/Streets.
**Addresses:** Natural language route description (P0 differentiator), route quality explanations (P1), vibe-based modes.
**Avoids:** Pitfall #8 (Claude API key MUST be server-proxied -- this is non-negotiable).

### Phase 4: Green Space Scoring and Data Enrichment
**Rationale:** Green space preference is Trail Router's signature feature and a strong differentiator. It requires OSM land-use polygon queries (parks, forests, water) and spatial intersection calculations -- building on the data layer from Phase 1 and the scoring pipeline from Phase 2. This phase also enriches scoring with surface quality, continuity analysis, and proxy popularity signals (route relations, POI density).
**Delivers:** Green index scoring (30m buffer intersection with green features), surface quality scoring, continuity scoring, popularity proxy signals from OSM route relations.
**Addresses:** Green space preference (P1), multi-source data fusion (P1), popularity-weighted routing (partial, using OSM proxies).
**Avoids:** Pitfall #4 (fully realizes multi-factor scoring), #5 (validates scoring globally via golden test set).

### Phase 5: GPX Export, PWA Polish, and Global Validation
**Rationale:** GPX export is a P0 table stake that enables real-world use. PWA polish (offline routes, install prompt, service worker caching) makes the app production-ready. Global validation runs the golden test set comprehensively and fixes region-specific failures before any public launch.
**Delivers:** GPX export, refined PWA caching (map tiles, routes), mobile performance optimization (Canvas renderer, GeoJSON simplification), global quality validation across 20+ test locations.
**Addresses:** GPX export (P0), mobile-responsive design, offline route access (partial).
**Avoids:** Pitfall #5 (global validation formalized), #11 (Leaflet performance), #15 (Unicode handling for Japan and global use).

### Phase 6: Scale and Reliability
**Rationale:** After the product works well globally, address the scaling ceiling. ORS free tier limits route generation to ~400/day across all users. This phase introduces self-hosted routing (ORS Docker or Valhalla) via a thin serverless proxy, which also solves the API key exposure problem.
**Delivers:** Serverless proxy for API keys and rate limiting, self-hosted routing engine option, recovery strategies for API failures, route issue reporting.
**Addresses:** Offline map tile download (P2), safety-aware routing (P2), POI integration (P2).
**Avoids:** Pitfall #9 (ORS rate limit wall), #8 (API key exposure via proxy).

### Phase Ordering Rationale

- **Data before algorithms:** Scoring and routing are only as good as the trail data they operate on. Phase 1 (data) must precede Phase 2 (algorithms).
- **Algorithms before LLM:** Natural language input translates "scenic waterfront" into scoring weights -- it needs the scoring pipeline to exist first. Phase 2 before Phase 3.
- **Green scoring as enrichment:** Green space scoring builds on top of the base scoring pipeline, not alongside it. Phase 4 after Phase 2.
- **GPX and polish after core works:** GPX export is simple to build but premature without good routes. Global validation requires all scoring factors to be in place. Phase 5 after Phase 4.
- **Scale last:** Scaling problems are good problems to have. Do not optimize for 10K users before the product works for 1 user in Japan. Phase 6 is genuinely last.
- **Pitfall cascade prevention:** Architecture decisions in Phase 1 (removing Strava dependency, defining golden test set, establishing adapter pattern) prevent costly rewrites in later phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Routing and Scoring):** The waypoint-based trail forcing strategy is well-documented in concept but requires experimentation to tune. How many waypoints per route? How to handle areas where ORS snaps to roads despite trail waypoints? Consider investigating Valhalla as an alternative. Needs `/gsd:research-phase`.
- **Phase 3 (Natural Language Input):** LLM integration for route generation is bleeding-edge (PathGPT and LLMAP are 2024-2025 papers). Prompt engineering for translating vibes to scoring weights needs iteration. Claude API key proxying architecture needs design. Needs `/gsd:research-phase`.
- **Phase 4 (Green Space Scoring):** Trail Router's blog post documents the green index approach well, but the Overpass queries for land-use polygons in dense cities (Tokyo, London) may hit performance limits. Needs some research but has a clear reference implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Modular JS architecture, EventBus, Proxy state store, IndexedDB caching, Overpass queries -- all well-documented patterns with multiple reference implementations.
- **Phase 5 (GPX Export and PWA Polish):** GPX is a simple XML format. PWA caching via Workbox is extensively documented. Leaflet Canvas renderer is a one-line change. Standard patterns throughout.
- **Phase 6 (Scale):** Self-hosted ORS via Docker is documented by ORS. Cloudflare Workers for API proxying is well-trodden. Standard DevOps patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via official releases and documentation. Vite 8, Leaflet 1.9.4, Turf.js 7.3.x, idb 8.x all current stable. Version compatibility confirmed. |
| Features | HIGH | Nine competitors analyzed with feature matrices. Competitive gaps validated across multiple review sources. Natural language input confirmed as novel via competitor audit. |
| Architecture | MEDIUM-HIGH | Patterns are proven (EventBus, Proxy state, adapter pattern, Web Workers) but the specific composition for a geospatial PWA is less documented. Trail Router blog post is the closest reference architecture. |
| Pitfalls | HIGH | Corroborated across OSM wiki, routing engine docs, Trail Router post-mortem, academic research, and HN community discussions. The Strava restriction is confirmed via official Strava press release. |

**Overall confidence:** MEDIUM-HIGH

The stack and pitfalls are well-researched with high-confidence sources. The architecture patterns are individually proven but their composition is less certain -- the "right" number of waypoints, gap tolerance values, and scoring weights will need empirical tuning. The biggest remaining uncertainty is whether OSM signals alone (without Strava popularity data) can produce the "local knowledge" feel. Trail Router's success suggests yes, but Stride's ambition to work globally (including data-sparse regions) introduces risk that only real-world testing can resolve.

### Gaps to Address

- **Popularity data substitute:** Strava is unavailable. OSM route relations and proxy signals (POI density, highway classification) are theorized but unvalidated as popularity substitutes. Validate during Phase 2 by comparing OSM-signal-based scoring against known good running routes in 3+ cities.
- **Valhalla as routing alternative:** Research identifies Valhalla's dynamic runtime costing as potentially superior to ORS/OSRM for trail preference. Not included in the stack because it requires self-hosting, but should be evaluated during Phase 2 research if ORS waypoint forcing proves insufficient.
- **Claude API key security model:** The architecture requires Claude API calls for natural language input and sightseeing mode. A client-side PWA cannot safely store Claude API keys. A thin serverless proxy (Cloudflare Worker) is the assumed solution but is not fully designed. Must resolve before Phase 3.
- **Global OSM data quality variance:** Research confirms OSM coverage is excellent in Japan and Europe but sparse in parts of Africa and South America. The graceful degradation strategy (fall back to road-based routes with clear messaging) is defined conceptually but not tested.
- **Iterative distance refinement convergence:** The iterative loop (generate, measure, adjust, re-route) may not converge for certain route shapes (e.g., constrained peninsulas, islands). Need to define convergence failure handling and maximum iteration limits during Phase 2.

## Sources

### Primary (HIGH confidence)
- [Vite 8 Announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown integration, build system capabilities
- [Leaflet 1.9.4 Release](https://github.com/Leaflet/Leaflet/releases) -- stable release, plugin ecosystem status
- [Turf.js Documentation](https://turfjs.org/) -- modular import strategy, function coverage
- [ORS JavaScript Client](https://github.com/GIScience/openrouteservice-js) -- API capabilities, rate limits
- [OSRM API Documentation](https://project-osrm.org/docs/v5.24.0/api/) -- foot profile, HTTP API
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) -- query patterns, endpoint resilience
- [OSM Highway Tags](https://wiki.openstreetmap.org/wiki/Tag:highway=path) -- comprehensive tag taxonomy
- [Strava API Agreement Update](https://press.strava.com/articles/updates-to-stravas-api-agreement) -- data restriction confirmation
- [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) -- off-thread computation patterns
- [vite-plugin-pwa Documentation](https://vite-pwa-org.netlify.app/) -- PWA scaffolding, Workbox integration

### Secondary (MEDIUM confidence)
- [How Trail Router Works](https://trailrouter.com/blog/how-trail-router-works/) -- green index algorithm, round-trip routing, repetition avoidance (closest reference architecture to Stride)
- [Trail Router HN Discussion](https://news.ycombinator.com/item?id=23802317) -- community-reported OSM coverage gaps, real-world scoring failures
- [Strava Route Builder AI Complaints](https://communityhub.strava.com/strava-features-chat-5/ai-generated-route-generator-creates-lousy-routes-10052) -- competitor quality issues, user expectations
- [OSM Data Quality by Country](https://www.nature.com/articles/s41467-023-39698-6) -- 83% global road coverage, regional heterogeneity
- [FOSS Routing Engines Overview](https://github.com/gis-ops/tutorials/blob/master/general/foss_routing_engines_overview.md) -- OSRM vs Valhalla vs GraphHopper comparison
- [PathGPT: LLM Route Recommendation](https://arxiv.org/abs/2504.05846) -- LLM-based route generation feasibility

### Tertiary (LOW confidence)
- [Strava Heatmap Tile Access](https://wiki.openstreetmap.org/wiki/Strava) -- unauthenticated tile URLs, cookie expiry behavior (fragile, may change)
- Vanilla JS Proxy state management pattern -- multiple community sources, no authoritative reference (low risk given simplicity)
- Region-specific circuity factors (urban: 1.2, mountain: 1.6-2.0) -- derived from general geographic literature, not validated for running specifically

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
