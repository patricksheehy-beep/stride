---
phase: 04-export-map-experience-and-pwa
plan: 01
subsystem: export, routing, map
tags: [gpx, chart.js, elevation, ors, xml, download]

# Dependency graph
requires:
  - phase: 01-modular-architecture-and-infrastructure
    provides: ORS adapter with routing methods, Vite build system
provides:
  - ORS adapter returning 3D coordinates and turn-by-turn instructions
  - GPX 1.1 XML builder with elevation and waypoint support
  - Client-side file download utility
  - Chart.js elevation profile chart component
  - Elevation stats calculator (ascent, descent, min/max)
affects: [04-02, 04-03, export-ui, map-experience]

# Tech tracking
tech-stack:
  added: [chart.js]
  patterns: [xml-string-builder, coordinate-downsampling, blob-download]

key-files:
  created:
    - src/export/gpx-builder.js
    - src/export/download.js
    - src/map/elevation-chart.js
    - tests/export/gpx-builder.test.js
    - tests/map/elevation-chart.test.js
  modified:
    - src/routing/adapters/ors.js
    - tests/routing/ors.test.js
    - package.json

key-decisions:
  - "Chart.js tree-shaking: import only LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip"
  - "Haversine approximation (sqrt(dlat^2 + dlng^2) * 111.32 km) sufficient for consecutive GPS point distances"
  - "Coordinate downsampling to max 200 points for chart performance"
  - "XML string builder pattern instead of DOM-based XML serialization (simpler, no DOM dependency)"

patterns-established:
  - "GPX export: buildGPX(geojson, metadata) pattern with escapeXml for safe XML generation"
  - "File download: Blob + object URL + anchor click pattern for client-side downloads"
  - "Elevation stats: coordinate[2] access pattern for 3D elevation data"

requirements-completed: [EXPORT-01, EXPORT-05]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 04 Plan 01: Enriched Route Data, GPX Export, and Elevation Profile Summary

**ORS adapter upgraded to 3D coordinates with instructions, GPX 1.1 XML export builder, and Chart.js elevation profile component with stats calculator**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T20:16:51Z
- **Completed:** 2026-03-27T20:21:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ORS adapter now returns 3D coordinates [lng, lat, elevation] and turn-by-turn instruction steps from both route() and roundTrip() methods
- GPX builder converts any GeoJSON FeatureCollection to valid GPX 1.1 XML with track points, elevation, waypoints, and proper XML escaping
- Elevation stats calculator correctly computes total ascent/descent, min/max elevation from 3D coordinate arrays with edge case handling
- Chart.js elevation profile chart component with gold accent styling, dark theme grid colors, and coordinate downsampling for performance
- 24 new tests across 3 test files, all passing; 299 total tests, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable ORS elevation + instructions and build GPX export**
   - `6cc80b5` (test) - Failing tests for GPX builder and ORS elevation/instructions
   - `b2ef001` (feat) - ORS elevation/instructions, GPX builder, and download utility

2. **Task 2: Install Chart.js and build elevation profile component**
   - `f80cb60` (test) - Failing tests for elevation stats calculator
   - `57a5a36` (feat) - Chart.js elevation profile component with stats calculator

_Note: TDD tasks have two commits each (test -> feat)_

## Files Created/Modified
- `src/routing/adapters/ors.js` - Added elevation: true, instructions: true, instructions_format: text to both buildRequestBody and roundTrip
- `src/export/gpx-builder.js` - GeoJSON-to-GPX 1.1 XML converter with trkpt, ele, wpt, and escapeXml
- `src/export/download.js` - Client-side Blob download trigger via anchor element
- `src/map/elevation-chart.js` - Chart.js line chart for elevation profile + calculateElevationStats + destroyElevationChart
- `tests/export/gpx-builder.test.js` - 6 GPX builder tests + 1 download test
- `tests/map/elevation-chart.test.js` - 6 elevation stats tests
- `tests/routing/ors.test.js` - 5 new ORS tests for elevation/instructions/roundTrip
- `package.json` - Added chart.js dependency

## Decisions Made
- Chart.js tree-shaking: imported only the 8 specific components needed (LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip) instead of the full library
- Used simple haversine approximation (sqrt(dlat^2 + dlng^2) * 111.32 km) for cumulative distance calculation -- sufficient accuracy for consecutive GPS points on an elevation chart
- Coordinate downsampling to max 200 points for chart rendering performance
- XML string builder pattern instead of DOM-based XML serialization -- simpler, no DOM dependency needed, and GPX is a simple format
- Test regex for XML escaping validation refined to check all ampersands are part of valid XML entities rather than a naive pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed XML escaping test regex**
- **Found during:** Task 1 (GPX builder tests)
- **Issue:** Test regex `/<name>[^<]*[&][^a][^<]*<\/name>/` incorrectly matched properly escaped entities like `&lt;` and `&gt;` (where `&` is followed by a non-`a` character)
- **Fix:** Replaced with proper validation that checks every `&` in name content is followed by a valid XML entity (amp, lt, gt, quot, apos)
- **Files modified:** tests/export/gpx-builder.test.js
- **Verification:** All GPX builder tests pass
- **Committed in:** b2ef001 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor test refinement. No scope creep.

## Issues Encountered
- npm install chart.js failed without --legacy-peer-deps flag (peer dependency conflict with Vite 8). Used --legacy-peer-deps as established in Phase 1 decisions.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all modules are fully implemented with real logic.

## Next Phase Readiness
- GPX export infrastructure ready for UI integration in Plan 03
- Elevation chart component ready for map panel integration in Plan 03
- ORS 3D data flowing to enable all downstream elevation features
- Chart.js installed and registered for any future chart components

## Self-Check: PASSED

All 7 created/modified files verified on disk. All 4 task commits verified in git history.

---
*Phase: 04-export-map-experience-and-pwa*
*Completed: 2026-03-27*
