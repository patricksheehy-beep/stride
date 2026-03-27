# Roadmap: Stride

## Overview

Stride transforms from a monolithic prototype into a modular, globally-capable route generation engine. The journey starts with architecture and data foundations, builds the core route generation and scoring algorithms, layers on natural language intelligence and data enrichment (Stride's key differentiators), polishes the user-facing experience with export/PWA/mobile capabilities, and validates everything works across continents. Each phase delivers a coherent capability that builds on the last -- the app gets meaningfully better for runners after every phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Architecture Foundation and Data Layer** - Modular codebase with comprehensive trail discovery, routing engine adapters, and data caching
- [ ] **Phase 2: Route Building and Scoring Engine** - Loop generation, distance accuracy, multi-candidate ranking, and multi-factor trail scoring
- [ ] **Phase 3: Natural Language, Route Intelligence, and Data Enrichment** - Claude-powered NL input, route explanations, data fusion, and green space scoring
- [ ] **Phase 4: Export, Map Experience, and PWA** - GPX export, elevation profiles, responsive mobile UI, offline PWA, and background processing
- [ ] **Phase 5: Global Validation** - Golden test set across continents with region-adaptive tag handling

## Phase Details

### Phase 1: Architecture Foundation and Data Layer
**Goal**: The app has a clean modular architecture with comprehensive trail discovery that fetches all relevant running surfaces globally, routes through trail-aware engines, caches results, and adapts to regional OSM conventions
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-04, DATA-01, DATA-02, DATA-05
**Success Criteria** (what must be TRUE):
  1. App loads from a modular ES Module architecture with clear component boundaries (not a single index.html)
  2. Overpass queries return all trail types near a location -- paths, footways, tracks, cycleways, named routes -- not just a subset of highway tags
  3. Routing requests go through ORS foot-hiking profile with OSRM as automatic fallback when ORS fails or is rate-limited
  4. Repeated requests for the same area load trail data from IndexedDB cache instead of re-querying Overpass
  5. Trail discovery works correctly in both US-style and Japan-style OSM tagging conventions without manual configuration
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Vite project scaffold, core infrastructure (EventBus, State, Config, Cache), Leaflet map
- [x] 01-02-PLAN.md -- Overpass adapter, comprehensive query builder, region-adaptive profiles
- [x] 01-03-PLAN.md -- ORS/OSRM routing adapters, EngineManager fallback chain

### Phase 2: Route Building and Scoring Engine
**Goal**: Users can generate high-quality loop routes at a requested distance, receive multiple ranked candidates, and trust that routes prefer trails and quality surfaces over roads
**Depends on**: Phase 1
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-07
**Success Criteria** (what must be TRUE):
  1. User can request a loop route and receive a circular route (not out-and-back) that returns to the starting point
  2. Generated route distance is within 10% of the user's requested distance
  3. User receives 3 or more route options ranked from best to worst for each request
  4. Routes visibly prefer trails, paths, and unpaved surfaces over roads when both are available nearby
  5. Each route has a multi-factor quality score incorporating surface quality, trail continuity, scenic value, and water/green proximity
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Multi-factor scoring engine (surface, trail preference, continuity, scenic) with configurable region weights
- [x] 02-02-PLAN.md -- ORS round_trip support, RouteBuilder with loop generation, waypoint trail forcing, and distance refinement
- [x] 02-03-PLAN.md -- RouteGenerator pipeline integrating generation + scoring + ranking, wired to app state and EventBus

### Phase 3: Natural Language, Route Intelligence, and Data Enrichment
**Goal**: Users can describe the run they want in plain English and receive routes that match, with explanations of why each route was chosen, powered by enriched data from multiple OSM signal types
**Depends on**: Phase 2
**Requirements**: ROUTE-05, ROUTE-06, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. User can type a natural language description like "shady waterfront trail" or "hilly forest run" and receive routes that match the described vibe
  2. Each generated route includes a human-readable explanation of why it was chosen -- referencing trail names, landmarks, surface types, and scenic highlights
  3. Route scoring incorporates fused data from OSM trail geometry, route relations, land-use polygons, surface tags, and trail naming to approximate "where locals run"
  4. Green space scoring calculates proximity to parks, nature reserves, water bodies, and tree cover, and routes through green areas rank higher than equivalent road routes
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Land-use data pipeline (Overpass polygon query + normalization) and green space scoring factor with 5-factor weight expansion
- [ ] 03-02-PLAN.md -- Claude API client, NL parser (vibes to weight adjustments), and weight merging
- [ ] 03-03-PLAN.md -- Route explanation generation and full pipeline integration (NL + green space + explanations wired into RouteGenerator)

### Phase 4: Export, Map Experience, and PWA
**Goal**: The app is a production-ready PWA where users can export routes to GPS devices, view detailed route information on a responsive map, and use the app offline on mobile
**Depends on**: Phase 3
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. User can export any generated route as a GPX file that loads correctly on Garmin Connect and Apple Watch
  2. Map interface works on mobile phone screens with touch-friendly controls and readable route information
  3. Routes display turn-by-turn waypoints with distance markers on the map
  4. Route detail view shows an elevation profile with climbs, descents, and total elevation gain
  5. App can be installed as a PWA on mobile home screen and loads previously generated routes without an internet connection
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Global Validation
**Goal**: Route quality is verified across diverse geographies worldwide, and the system automatically adapts to regional differences in OSM data
**Depends on**: Phase 4
**Requirements**: GLOBAL-01, GLOBAL-02
**Success Criteria** (what must be TRUE):
  1. A golden test set of 20+ locations across 3+ continents produces acceptable route quality, and this test set runs after every algorithm change
  2. Region-adaptive OSM tag handling automatically detects and adjusts for local tagging conventions (US vs Europe vs Japan vs others) without user intervention
  3. Route generation in data-sparse regions gracefully degrades with clear messaging rather than producing broken or unrunnable routes
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Architecture Foundation and Data Layer | 3/3 | Complete | 2026-03-25 |
| 2. Route Building and Scoring Engine | 0/3 | Planning complete | - |
| 3. Natural Language, Route Intelligence, and Data Enrichment | 0/3 | Planning complete | - |
| 4. Export, Map Experience, and PWA | 0/3 | Not started | - |
| 5. Global Validation | 0/2 | Not started | - |
