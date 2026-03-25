---
phase: 01-architecture-foundation-and-data-layer
plan: 03
subsystem: routing
tags: [ors, osrm, geojson, routing, fallback, indexeddb-cache]

# Dependency graph
requires:
  - phase: 01-architecture-foundation-and-data-layer
    provides: "Core config, event bus, and IndexedDB cache from Plan 01"
provides:
  - "ORSAdapter: foot-hiking routing with green/quiet trail preferences"
  - "OSRMAdapter: fallback routing with GeoJSON normalization"
  - "EngineManager: ORS-first fallback chain with IndexedDB caching and event lifecycle"
affects: [route-generation, scoring-pipeline, map-display]

# Tech tracking
tech-stack:
  added: []
  patterns: ["adapter pattern for routing engines", "GeoJSON FeatureCollection normalization", "fallback chain with event-driven lifecycle"]

key-files:
  created:
    - src/routing/adapters/ors.js
    - src/routing/adapters/osrm.js
    - src/routing/engine-manager.js
    - tests/routing/ors.test.js
    - tests/routing/osrm.test.js
    - tests/routing/engine-manager.test.js
  modified: []

key-decisions:
  - "Direct fetch() for both ORS and OSRM instead of client libraries -- simpler, fewer dependencies, matches CLAUDE.md stack guidance"
  - "OSRM normalizes to GeoJSON FeatureCollection to match ORS native format -- consumers get uniform output regardless of engine"

patterns-established:
  - "Routing adapter pattern: each engine exposes async route(waypoints) returning GeoJSON FeatureCollection"
  - "Fallback chain: EngineManager iterates engines in priority order, emitting lifecycle events at each transition"
  - "Cache-first routing: check IndexedDB before network calls, store results on success"

requirements-completed: [DATA-02, ARCH-04]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 01 Plan 03: Routing Engines Summary

**Dual routing engine system with ORS foot-hiking primary, OSRM fallback, GeoJSON normalization, and IndexedDB caching via EngineManager**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T23:40:04Z
- **Completed:** 2026-03-25T23:43:11Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- ORS adapter sends foot-hiking requests with green/quiet trail preferences and coordinate order conversion
- OSRM adapter provides seamless fallback with meters-to-km distance normalization and GeoJSON FeatureCollection output
- EngineManager orchestrates ORS-first fallback chain with IndexedDB caching and event lifecycle (started, completed, fallback, cache-hit)
- 31 routing tests passing (19 adapter tests + 12 EngineManager tests), full suite 80/80

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ORS and OSRM routing adapters** - `356e8cd` (test: RED), `cf527c8` (feat: GREEN)
2. **Task 2: Build EngineManager with fallback chain** - `c511f44` (test: RED), `6c3964a` (feat: GREEN)

_TDD tasks committed separately: failing tests first, then implementation._

## Files Created/Modified
- `src/routing/adapters/ors.js` - ORS foot-hiking routing adapter with green/quiet preferences
- `src/routing/adapters/osrm.js` - OSRM fallback adapter with GeoJSON normalization
- `src/routing/engine-manager.js` - Engine orchestrator with ORS-first fallback, caching, and events
- `tests/routing/ors.test.js` - 8 tests for ORS adapter constructor and request body
- `tests/routing/osrm.test.js` - 11 tests for OSRM adapter constructor, URL builder, and response normalization
- `tests/routing/engine-manager.test.js` - 12 tests for fallback chain, caching, and event emissions

## Decisions Made
- Direct fetch() for both ORS and OSRM instead of client libraries -- simpler, fewer dependencies, matches stack guidance
- OSRM normalizes to GeoJSON FeatureCollection to match ORS native format -- consumers get uniform output regardless of engine
- Cache key uses `route:lat,lng;lat,lng` format for deterministic, human-readable keys

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertion: toBe to toEqual for cached route comparison**
- **Found during:** Task 2 (EngineManager cache tests)
- **Issue:** Test used `toBe` (reference equality) for cached route object, but IndexedDB deserialization creates new object reference
- **Fix:** Changed to `toEqual` (deep equality) in cache verification test
- **Files modified:** tests/routing/engine-manager.test.js
- **Verification:** All 12 EngineManager tests pass
- **Committed in:** 6c3964a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test assertion fix required for IndexedDB deserialization behavior. No scope creep.

## Issues Encountered
None -- plan executed cleanly.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None -- all modules are fully implemented with real data paths. ORS requires an API key at runtime (retrieved from localStorage via getApiKey), but this is by-design per the config module from Plan 01.

## Next Phase Readiness
- Routing engine system complete, ready for route generation pipeline
- EngineManager can be instantiated with `new EngineManager(new ORSAdapter(apiKey), new OSRMAdapter())`
- Pre-existing test failure in `tests/data/overpass.test.js` (references source from Plan 02 not yet executed) -- unrelated to this plan

---
*Phase: 01-architecture-foundation-and-data-layer*
*Completed: 2026-03-25*
