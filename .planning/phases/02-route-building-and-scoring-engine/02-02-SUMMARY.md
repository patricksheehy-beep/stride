---
phase: 02-route-building-and-scoring-engine
plan: 02
subsystem: routing
tags: [ors-round-trip, loop-routes, distance-refinement, waypoint-snapping, turf.js, route-builder]

# Dependency graph
requires:
  - phase: 02-route-building-and-scoring-engine
    plan: 01
    provides: "RouteScorer class, @turf/length, @turf/bearing, @turf/destination, @turf/nearest-point-on-line"
  - phase: 01-modular-architecture-and-data-pipeline
    provides: "ORSAdapter, EngineManager, EventBus, Overpass trail GeoJSON"
provides:
  - "ORSAdapter.roundTrip method for ORS round_trip loop generation"
  - "RouteBuilder class orchestrating loop generation via round_trip seeds and waypoint-based trail forcing"
  - "buildLoopWaypoints placing 4 waypoints at angular spacing, snapped to trail geometry"
  - "refineDistance iterative convergence within 10% of target distance"
  - "generateCandidatesViaRoundTrip with seed variation for multiple distinct loop candidates"
  - "generateCandidateViaWaypoints forcing routes through trail segments"
affects: [02-03-PLAN, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["seed-varied round_trip for multiple candidates", "waypoint snapping to trail geometry via nearest-point-on-line", "iterative proportional distance refinement", "early-return optimization in candidate generation"]

key-files:
  created:
    - src/routing/route-builder.js
    - tests/routing/ors-round-trip.test.js
    - tests/routing/route-builder.test.js
  modified:
    - src/routing/adapters/ors.js

key-decisions:
  - "ORS roundTrip uses single coordinate with round_trip.length in meters, round_trip.points=5, and seed variation"
  - "RouteBuilder generates count+2 seed attempts and stops early when enough candidates collected"
  - "Waypoint snapping uses @turf/nearest-point-on-line against all trail LineString features, falling back to raw geometric position"
  - "Distance refinement adjusts target proportionally (ratio = targetKm/actualKm) and tracks best candidate across iterations"

patterns-established:
  - "Seed variation pattern: generate count+2 attempts, collect up to count, handle per-seed failures gracefully"
  - "Geometric waypoint placement: @turf/destination at [0, 90, 180, 270] bearings, radius = targetKm / (2*PI)"
  - "Trail snapping: iterate all trail features, find nearest point on each line, pick minimum distance"
  - "Iterative refinement: measure actual via @turf/length, adjust proportionally, cap iterations"

requirements-completed: [ROUTE-01, ROUTE-02]

# Metrics
duration: 13min
completed: 2026-03-27
---

# Phase 02 Plan 02: Route Builder and ORS Round Trip Summary

**ORS round_trip loop generation with seed variation, waypoint-based trail forcing via nearest-point-on-line snapping, and iterative distance refinement converging within 10% of target**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-27T13:27:12Z
- **Completed:** 2026-03-27T13:40:46Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- Extended ORSAdapter with roundTrip method sending correct ORS round_trip parameters (single coordinate, length in meters, seed, no alternative_routes)
- Built RouteBuilder class with dual candidate generation: ORS round_trip with seed variation (quick, 1 API call/candidate) and waypoint-based trail forcing (snaps to real trail geometry)
- Implemented iterative distance refinement that adjusts proportionally and tracks best candidate across up to 3 iterations
- Waypoint snapping uses @turf/nearest-point-on-line against trail LineString features, ensuring waypoints land on actual trails not arbitrary geometric positions
- 24 new tests + 149 existing = 173 total tests passing

## Task Commits

Each task was committed atomically (TDD workflow):

1. **Task 1 RED: Failing tests for ORS roundTrip and RouteBuilder** - `b6f8c3b` (test)
2. **Task 1 GREEN: Implement ORS roundTrip and RouteBuilder** - `8ddafb0` (feat)

## Files Created/Modified

- `src/routing/adapters/ors.js` - Added roundTrip method to existing ORSAdapter (additive, existing route method untouched)
- `src/routing/route-builder.js` - NEW: RouteBuilder class with generateCandidatesViaRoundTrip, generateCandidateViaWaypoints, buildLoopWaypoints, refineDistance, _snapToNearestTrail
- `tests/routing/ors-round-trip.test.js` - 9 tests for roundTrip request construction and error handling
- `tests/routing/route-builder.test.js` - 15 tests for constructor, candidate generation, waypoint placement, distance refinement

## Decisions Made

- **Early return in candidate generation:** When all seeds succeed, stop at count instead of running all count+2. This saves API calls while still having the count+2 safety margin for when seeds fail.
- **Track best candidate in refinement:** Instead of just returning the last iteration, track the closest-to-target candidate across all iterations and return it if tolerance is never reached.
- **Fallback for waypoint snapping:** If no trail features exist or all fail to process, fall back to raw geometric position rather than crashing. Handles data-sparse regions gracefully.
- **round_trip and alternative_routes mutually exclusive:** ORS docs confirm these cannot be combined. Use seed variation (0, 1, 2, ...) instead for multiple candidates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test expectation for early-return optimization**
- **Found during:** Task 1 GREEN (test verification)
- **Issue:** Test expected all count+2 (5) roundTrip calls even when the first 3 succeed, but the implementation correctly stops early after collecting count (3) candidates
- **Fix:** Updated test to verify sequential seeds on actual call count, added separate test for count+2 behavior when seeds fail
- **Files modified:** tests/routing/route-builder.test.js
- **Verification:** All 24 tests pass
- **Committed in:** 8ddafb0 (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test expectation)
**Impact on plan:** Test expectation corrected to match actual early-return optimization. No scope creep.

## Known Stubs

None - all modules are fully functional with real routing logic.

## Issues Encountered

None - implementation followed research patterns directly and all tests passed after the one test expectation correction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RouteBuilder ready for Plan 03 (pipeline) to orchestrate full route generation flow: fetch trails, generate candidates, score, rank, return best
- ORS roundTrip method ready for integration with EngineManager caching and rate limit handling
- Distance refinement ready for pipeline to call after initial candidate generation
- All 173 tests passing, full suite green

## Self-Check: PASSED

- All 4 source/test files exist on disk
- Both commits (b6f8c3b, 8ddafb0) found in git log
- 173 total tests passing (24 new + 149 existing)

---
*Phase: 02-route-building-and-scoring-engine*
*Completed: 2026-03-27*
