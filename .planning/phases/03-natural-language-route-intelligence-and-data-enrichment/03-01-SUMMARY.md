---
phase: 03-natural-language-route-intelligence-and-data-enrichment
plan: 01
subsystem: data, scoring
tags: [overpass, geojson, turf, polygon, green-space, point-in-polygon, scoring]

# Dependency graph
requires:
  - phase: 02-route-building-and-scoring-engine
    provides: "4-factor RouteScorer with weights, Overpass adapter with fetchTrails, query-builder"
provides:
  - "buildLandUseQuery for fetching parks/forests/water polygons from Overpass"
  - "normalizeToPolygons converting closed OSM ways to Polygon GeoJSON"
  - "fetchLandUse adapter method with 7-day cache TTL"
  - "scoreGreenSpace geometric route-through-polygon coverage factor"
  - "5-factor weight profiles (surface, continuity, trailPreference, scenic, greenSpace)"
affects: [03-02-PLAN, 03-03-PLAN, route-generation, scoring-pipeline]

# Tech tracking
tech-stack:
  added: ["@turf/buffer@7.3.4"]
  patterns: ["geometric point-in-polygon sampling at 100m intervals", "polygon normalization pipeline (Overpass -> GeoJSON -> Polygon-only)", "neutral base scoring (0.4) for data-sparse regions"]

key-files:
  created:
    - "src/data/enrichment.js"
    - "src/scoring/factors/green-space.js"
    - "tests/data/land-use-query.test.js"
    - "tests/data/enrichment.test.js"
    - "tests/scoring/green-space.test.js"
  modified:
    - "src/data/query-builder.js"
    - "src/data/adapters/overpass.js"
    - "src/scoring/weights.js"
    - "src/scoring/scorer.js"
    - "tests/data/overpass.test.js"
    - "tests/scoring/weights.test.js"
    - "tests/scoring/scorer.test.js"
    - "package.json"

key-decisions:
  - "Neutral base 0.4 for green space when no land-use data (avoids penalizing data-sparse regions)"
  - "100m sampling interval for point-in-polygon testing (balance of accuracy vs performance)"
  - "greenSpace weight 0.20 across all regions; scenic reduced 0.20->0.15 (greenSpace handles geometric measurement scenic approximated)"
  - "Land-use cache TTL 7 days (land-use polygons change rarely)"
  - "Waterway queried as way only (not relation) since rivers/streams are linear features"

patterns-established:
  - "Enrichment pipeline: Overpass raw -> normalizeOverpassToGeoJSON -> normalizeToPolygons -> polygon-only FeatureCollection"
  - "Geometric scoring: sample points along route at fixed intervals, test against polygon features"
  - "5-factor weight architecture: all region profiles include greenSpace, all sum to 1.0"

requirements-completed: [DATA-03, DATA-04]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 03 Plan 01: Land-Use Data Pipeline and Green Space Scoring Summary

**Overpass land-use query with polygon normalization pipeline and geometric green space scoring factor using @turf/along + @turf/boolean-point-in-polygon, expanding RouteScorer from 4 to 5 weighted factors**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T18:29:48Z
- **Completed:** 2026-03-27T18:36:48Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Land-use data pipeline: buildLandUseQuery fetches parks, forests, water, meadows from Overpass; normalizeToPolygons converts closed OSM ways to Polygon GeoJSON and filters out open ways
- Green space scoring with true geometric intersection: samples points every 100m along a route and tests if each falls inside any park/forest/water polygon
- 5-factor weight expansion across all 4 region profiles (default, japan, europe, us) -- all sum to 1.0
- Data-sparse graceful degradation: routes with no land-use data get neutral 0.4 score instead of zero
- 235 total tests passing (43 new tests added, zero regressions)

## Task Commits

Each task was committed atomically (TDD: RED test commit, then GREEN implementation commit):

1. **Task 1: Land-use Overpass query, fetchLandUse adapter, polygon normalization**
   - `cafa667` (test: failing tests for land-use query and enrichment)
   - `e5adbee` (feat: land-use data pipeline implementation)
2. **Task 2: Green space scoring factor, 5-factor weight expansion, scorer integration**
   - `4a20733` (feat: green space scoring, weight expansion, scorer integration)

## Files Created/Modified
- `src/data/query-builder.js` - Added buildLandUseQuery for parks/forests/water/meadow Overpass QL
- `src/data/enrichment.js` - New: normalizeToPolygons converts closed LineString ways to Polygon GeoJSON
- `src/data/adapters/overpass.js` - Added fetchLandUse method with 7-day cache, primary/fallback endpoints
- `src/scoring/factors/green-space.js` - New: scoreGreenSpace geometric point-in-polygon coverage scoring
- `src/scoring/weights.js` - Expanded from 4 to 5 factors (added greenSpace: 0.20) across all region profiles
- `src/scoring/scorer.js` - Integrated greenSpace as 5th scoring factor with optional landUseData parameter
- `tests/data/land-use-query.test.js` - New: 12 tests for buildLandUseQuery
- `tests/data/enrichment.test.js` - New: 10 tests for normalizeToPolygons
- `tests/data/overpass.test.js` - Extended: 6 new tests for fetchLandUse
- `tests/scoring/green-space.test.js` - New: 10 tests for scoreGreenSpace
- `tests/scoring/weights.test.js` - Extended: 3 new tests for greenSpace key and 5-factor profiles
- `tests/scoring/scorer.test.js` - Extended: 3 new tests for greenSpaceScore and landUseData parameter
- `package.json` - Added @turf/buffer dependency

## Decisions Made
- Neutral base 0.4 (not 0.0 or 0.5) for green space when no land-use data available -- avoids unfair penalization in data-sparse regions while still allowing meaningful differentiation when data exists
- 100m sampling interval chosen to balance accuracy (finer than 500m for small parks) with performance (not per-meter)
- Scenic weight reduced from 0.20 to 0.15 because greenSpace now handles the geometric green measurement that scenic previously approximated via feature counting -- scenic still valuable for water proximity and named trail detection
- Land-use cache TTL set to 7 days (vs 24h for trails) since park and forest boundaries change far less frequently than trail tagging
- Score formula: 0.2 + greenRatio * 0.8 maps 0% green to 0.2 (floor) and 100% green to 1.0 (ceiling)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functions are fully implemented with real logic and tested.

## Issues Encountered
- @turf/buffer installation required --legacy-peer-deps flag (same pattern as Phase 01 vite-plugin-pwa peer dep resolution)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Land-use data pipeline ready for Plan 02 (NL input parsing) and Plan 03 (route explanation) to consume
- fetchLandUse can be called from RouteGenerator to provide landUseData to RouteScorer
- scoreGreenSpace integrated into RouteScorer -- any caller passing landUseData to scoreRoute gets green space scoring automatically
- The 5-factor weight architecture is extensible for future factors

## Self-Check: PASSED

- All 5 created files exist on disk
- All 3 commit hashes (cafa667, e5adbee, 4a20733) found in git log
- 235 tests passing across 21 test files (0 failures)

---
*Phase: 03-natural-language-route-intelligence-and-data-enrichment*
*Completed: 2026-03-27*
