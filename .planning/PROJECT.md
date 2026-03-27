# Stride — AI Running Route Generator

## What This Is

Stride is a Progressive Web App that generates running, cycling, and hiking routes that feel like they were recommended by a local runner. Users describe what kind of run they want — distance, vibe, surface preferences — and the app builds routes using real trail geometry from multiple data sources, routes them through professional routing engines, and displays them on a Leaflet map with live GPS tracking. The goal is to work flawlessly in any geography on Earth — cities, suburbs, rural areas, mountains.

## Core Value

Every generated route should feel like a local runner recommended it — hitting the best trails, paths, and scenic spots in any location worldwide, with no dead ends, zig-zags, or unrunnable segments.

## Requirements

### Validated

- Codebase restructured from single index.html into modular ES Module architecture — Validated in Phase 1
- Overpass queries find all relevant trails, paths, and runnable routes near the user — Validated in Phase 1
- ORS foot-hiking routing with OSRM fallback — Validated in Phase 1
- Multi-factor scoring engine (surface, trail preference, continuity, scenic) with region-adaptive weights — Validated in Phase 2
- Loop route generation with iterative distance refinement (within 10% accuracy) — Validated in Phase 2
- 3+ ranked route candidates per request — Validated in Phase 2

### Active
- [ ] All three routing modes (Trail, Sightseeing, Streets-OK) produce high-quality results globally
- [ ] Route generation works across any terrain type — urban, suburban, rural, mountain
- [ ] Multiple data sources layered (OSM + Strava heatmaps + Google/Apple Maps) to fill gaps where any single source has sparse data
- [ ] No unrunnable routes — no dead ends, zig-zags, or road-heavy paths when trails exist

### Out of Scope

- User accounts / authentication — not needed for route generation quality
- Payment / Stripe integration — premature before route quality is proven globally
- App Store deployment — React Native rebuild deferred until core algorithm is world-class
- Social features / sharing — focus is on route quality, not community
- Strava OAuth integration — Strava heatmap data yes, but full OAuth/segment import is deferred

## Context

- **Current state:** Phase 1 complete — modular ES Module architecture with Vite, core infrastructure (EventBus, State, Config, Cache), Leaflet map, comprehensive Overpass trail discovery (8 highway types, 4 route relation types, region-adaptive for US/Europe/Japan), and dual routing engine (ORS foot-hiking + OSRM fallback). 92 tests passing.
- **Known issues:** OSM trail segments are fragmented (e.g., Bay Trail: 88 segments, 15km gaps). Overpass queries miss some trail types. Scoring formula over-weights proximity and under-weights route quality signals. OSRM's foot profile biases toward roads over trails. Works reasonably in Sunnyvale/Bay Area but untested globally.
- **Data sources today:** Overpass (OSM) for trail geometry, ORS for foot-hiking routing + elevation, OSRM as fallback, Claude for sightseeing waypoint selection, Nominatim for geocoding, Wikipedia for nearby photos.
- **Target data sources:** Add Strava heatmaps (where runners actually run), Google/Apple Maps (parks, paths, POIs) to supplement OSM and fill gaps in data-sparse regions.
- **Founder:** Patrick Sheehy — runner in Sunnyvale, CA. No dev experience. Builds everything with Claude. Cares deeply about continuous scenic trails, waterfront paths, and accurate distances. Plans to use Stride while running in Japan and globally.

## Constraints

- **No backend:** PWA runs entirely client-side. API keys stored in localStorage. Any new data sources must be accessible via client-side API calls or free/freemium endpoints.
- **API rate limits:** ORS free tier is 2000 req/day. Strava and Google Maps APIs have their own limits and may require API keys.
- **OSM data quality:** Varies dramatically by region. Japan has excellent OSM coverage; parts of Africa/South America may be sparse. The multi-source approach must gracefully handle missing data.
- **Single developer:** Patrick builds with Claude. Architecture must be understandable and maintainable without deep dev experience.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-source data approach (OSM + Strava + Google/Apple) | Single source (OSM) has gaps globally; layering sources fills holes | — Pending |
| Restructure from single file to modules | Single index.html won't scale with multi-source complexity and improved algorithms | — Pending |
| Keep as PWA (not React Native yet) | Focus on route quality first; framework rebuild is premature | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after Phase 2 completion*
