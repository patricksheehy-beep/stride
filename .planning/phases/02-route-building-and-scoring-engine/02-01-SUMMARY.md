---
phase: 02-route-building-and-scoring-engine
plan: 01
subsystem: scoring
tags: [turf.js, geospatial, scoring-engine, osm, surface-quality, trail-preference]

# Dependency graph
requires:
  - phase: 01-modular-architecture-and-data-pipeline
    provides: "Overpass trail GeoJSON format, region-profiles.js, @turf/helpers, @turf/distance, @turf/bbox"
provides:
  - "RouteScorer class orchestrating 4 scoring factors"
  - "scoreSurface: surface quality scoring from OSM surface tags"
  - "scoreTrailPreference: highway type preference scoring"
  - "scoreContinuity: route smoothness scoring via bearing analysis"
  - "scoreScenic: water/green/named-trail proximity scoring"
  - "DEFAULT_WEIGHTS and region-specific weight profiles (japan, europe, us)"
  - "getWeightsForRegion region-to-weights lookup"
affects: [02-02-PLAN, 02-03-PLAN, phase-03]

# Tech tracking
tech-stack:
  added: ["@turf/bearing@7.3.4", "@turf/destination@7.3.4", "@turf/length@7.3.4", "@turf/along@7.3.4", "@turf/boolean-point-in-polygon@7.3.4", "@turf/nearest-point-on-line@7.3.4", "@turf/center@7.3.4"]
  patterns: ["length-weighted scoring", "configurable weight profiles per region", "multi-factor weighted combination"]

key-files:
  created:
    - src/scoring/scorer.js
    - src/scoring/weights.js
    - src/scoring/factors/surface.js
    - src/scoring/factors/trail-preference.js
    - src/scoring/factors/continuity.js
    - src/scoring/factors/scenic.js
    - tests/scoring/scorer.test.js
    - tests/scoring/weights.test.js
    - tests/scoring/surface.test.js
    - tests/scoring/trail-preference.test.js
    - tests/scoring/continuity.test.js
    - tests/scoring/scenic.test.js
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Trail preference weight highest at 0.30 (directly addresses ROUTE-04: prefer trails over roads)"
  - "Missing surface tags score as 0.5 neutral (not zero) to handle OSM data gaps gracefully"
  - "Scenic scoring uses base + scaled approach (0.3 base, scaling to 1.0) to avoid penalizing data-sparse regions"
  - "Continuity uses 120-degree threshold for sharp turns (sourced from research, distinguishes U-turns from gentle curves)"
  - "Region weight profiles differ: Japan boosts surface (reliable tagging), Europe boosts trailPreference (trail networks), US boosts continuity (sparse tagging)"

patterns-established:
  - "Length-weighted scoring: factor modules use @turf/length to weight each trail feature's score by its geographic length"
  - "Lookup table pattern: SURFACE_SCORES and HIGHWAY_PREFERENCE objects map OSM tag values to 0-1 quality scores"
  - "Multi-signal aggregation: scenic factor combines 3 sub-signals (water, green, named-trail) with saturation caps"
  - "Configurable weight profiles: scoring weights stored in REGION_WEIGHTS keyed by region, looked up via getWeightsForRegion"

requirements-completed: [ROUTE-04, ROUTE-07]

# Metrics
duration: 35min
completed: 2026-03-26
---

# Phase 02 Plan 01: Scoring Engine Summary

**Multi-factor scoring engine with 4 factors (surface, trail preference, continuity, scenic), region-aware weight profiles, and RouteScorer orchestrator ranking trail-heavy routes above road-heavy routes**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-26T22:58:40Z
- **Completed:** 2026-03-26T23:33:47Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Built 4 independent scoring factor modules each returning a 0-1 quality score based on OSM trail data
- RouteScorer class combines all 4 factors using configurable weighted sum, with scoreAndRank returning sorted candidates
- Trail-heavy routes (path + fine_gravel) demonstrably score higher than road-heavy routes (residential + asphalt), validating ROUTE-04
- Region-specific weight profiles for japan, europe, us, and default -- all summing to 1.0
- 57 scoring tests + 92 existing Phase 1 tests = 149 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Turf packages and build four scoring factor modules** - `870c978` (feat)
2. **Task 2 RED: Failing tests for weights and scorer** - `307ccd6` (test)
3. **Task 2 GREEN: Build scoring weights module and RouteScorer orchestrator** - `0725efd` (feat)

## Files Created/Modified

- `src/scoring/factors/surface.js` - SURFACE_SCORES lookup (17 OSM surface types) + scoreSurface length-weighted average
- `src/scoring/factors/trail-preference.js` - HIGHWAY_PREFERENCE lookup (12 highway types) + scoreTrailPreference length-weighted average
- `src/scoring/factors/continuity.js` - scoreContinuity using @turf/bearing for sharp turn detection (>120 degrees)
- `src/scoring/factors/scenic.js` - scoreScenic with 3 sub-signals: water (0.4), green (0.3), named-trail (0.3)
- `src/scoring/weights.js` - DEFAULT_WEIGHTS, REGION_WEIGHTS, getWeightsForRegion
- `src/scoring/scorer.js` - RouteScorer class with scoreRoute and scoreAndRank
- `tests/scoring/surface.test.js` - 7 tests covering specific surfaces, missing tags, mixed surfaces
- `tests/scoring/trail-preference.test.js` - 7 tests covering specific highway types, missing tags, mixed types
- `tests/scoring/continuity.test.js` - 6 tests covering straight lines, sharp turns, edge cases
- `tests/scoring/scenic.test.js` - 9 tests covering water/green/named-trail detection, base score, name patterns
- `tests/scoring/weights.test.js` - 11 tests covering defaults, region profiles, sum validation, fallback
- `tests/scoring/scorer.test.js` - 10 tests covering construction, scoring, breakdown, weighted sum, ranking
- `package.json` - Added 7 @turf/* dependencies for Phase 2 geospatial operations

## Decisions Made

- **Trail preference highest default weight (0.30):** This directly addresses ROUTE-04 -- preferring trails over roads is the core differentiator. Surface and continuity tied at 0.25, scenic at 0.20.
- **Missing surface = 0.5 neutral:** OSM surface tags are missing on 30-60% of ways globally. Treating missing as 0 would unfairly penalize routes in data-sparse regions.
- **Scenic base score 0.3:** Routes without scenic indicators are not "bad" -- they just lack data. The 0.3 base prevents scenic factor from dominating the penalty.
- **120-degree sharp turn threshold:** Research-based threshold that catches U-turns and switchbacks while allowing natural trail curves.
- **Scenic sub-signal saturation:** Water saturates at 3 features, green at 5, named trails at 4. Prevents a single feature type from dominating.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all modules are fully functional with real scoring logic.

## Issues Encountered

None - the scoring factor modules from a prior partial execution were already present and passing all tests, so Task 1 code was verified and committed directly. Task 2 followed full TDD (RED then GREEN).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scoring engine ready for Plan 02 (route builder) to call RouteScorer.scoreAndRank on generated route candidates
- Weight profiles ready for Plan 03 (pipeline) to integrate with region detection from detectRegion()
- All 7 Turf packages installed and available for Plan 02 waypoint-based route generation

## Self-Check: PASSED

- All 12 source/test files exist on disk
- All 3 commits (870c978, 307ccd6, 0725efd) found in git log
- 149 total tests passing (57 scoring + 92 Phase 1)

---
*Phase: 02-route-building-and-scoring-engine*
*Completed: 2026-03-26*
