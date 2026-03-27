---
phase: 04-export-map-experience-and-pwa
plan: 03
subsystem: map, ui, export
tags: [leaflet, route-renderer, route-panel, responsive, gpx-export, elevation-chart, carto-dark, mobile]

# Dependency graph
requires:
  - phase: 04-export-map-experience-and-pwa
    plan: 01
    provides: GPX builder, elevation chart, download utility, ORS 3D coordinates and instructions
  - phase: 04-export-map-experience-and-pwa
    plan: 02
    provides: PWA manifest, service worker, offline fallback
provides:
  - Route renderer with gold polyline, turn-by-turn markers, and distance markers on Leaflet map
  - Responsive route info panel with elevation chart, stats, explanation, and GPX export
  - CartoDB Dark Matter default tiles with OSM layer switching
  - Mobile-first responsive layout (bottom sheet on mobile, side panel on desktop)
  - Full route display pipeline wired in app.js (generation -> rendering -> panel)
affects: [map-experience, export-ui, mobile-layout]

# Tech tracking
tech-stack:
  added: []
  patterns: [route-layer-group, mobile-bottom-sheet, event-driven-panel-updates, turf-distance-markers]

key-files:
  created:
    - src/map/route-renderer.js
    - src/ui/route-panel.js
    - tests/map/route-renderer.test.js
  modified:
    - src/map/layers.js
    - src/map/map-manager.js
    - src/app.js
    - index.html
    - styles/main.css

key-decisions:
  - "CartoDB Dark Matter as default tile layer with OSM switchable via Leaflet layer control"
  - "Route layer group pattern: map._strideRouteGroup stores all route-related layers for atomic clear/re-render"
  - "Trail name extraction from ORS instruction text via regex matching 'onto/on/along' patterns for EXPORT-04 local context"
  - "Mobile-first CSS: bottom sheet with drag handle on mobile, fixed side panel (380px) on desktop at 768px breakpoint"

patterns-established:
  - "Route layer group: all route visuals (polyline, markers) stored in map._strideRouteGroup for atomic clear/render"
  - "EventBus-driven UI: RoutePanel auto-updates via eventBus subscriptions, no direct coupling to generation pipeline"
  - "ORS instruction parsing: extractTurnPoints maps way_points[0] index to 3D coordinates for marker placement"
  - "Responsive panel pattern: CSS transform translateY/translateX with 0.3s ease transition for show/hide"

requirements-completed: [EXPORT-02, EXPORT-03, EXPORT-04]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 04 Plan 03: Route Display Experience with Markers, Panel, and Responsive Layout Summary

**Gold polyline route rendering on CartoDB Dark tiles with 1km distance markers, turn-by-turn instruction tooltips, responsive info panel with elevation chart and GPX export, and mobile-first layout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T20:24:39Z
- **Completed:** 2026-03-27T20:28:57Z
- **Tasks:** 2 automated + 1 checkpoint (pending)
- **Files modified:** 8

## Accomplishments
- Route renderer draws gold (#E8C547) polyline on CartoDB Dark Matter map with auto-fit bounds
- Distance markers at every 1km interval using @turf/along and @turf/length with styled divIcon circles
- Turn-by-turn circle markers at ORS instruction points with tooltip showing instruction text
- Responsive RoutePanel class showing distance, elevation gain/loss, score, elevation profile chart, explanation with local trail context, and GPX export button
- Mobile-first CSS layout: bottom sheet (40vh max) on mobile, 380px side panel on desktop
- Full pipeline wired in app.js: route generation -> polyline rendering -> turn markers -> distance markers -> panel update -> GPX export
- 303 tests passing across 28 test files, zero regressions, production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Route renderer with turn-by-turn markers and distance markers** (TDD)
   - `cc5975b` (test) - Failing tests for extractTurnPoints and addDistanceMarkers
   - `f90e718` (feat) - Route renderer implementation + dark tiles + layer control

2. **Task 2: Route info panel with elevation chart, GPX export, and mobile-responsive layout**
   - `1d8e1b3` (feat) - RoutePanel class, responsive CSS, app.js wiring, HTML updates

3. **Task 3: Visual verification of complete Phase 4 experience**
   - Status: CHECKPOINT (human-verify) - pending visual inspection

## Files Created/Modified
- `src/map/route-renderer.js` - Route polyline rendering, distance markers, turn markers, extractTurnPoints, clearRoute
- `src/ui/route-panel.js` - RoutePanel class with stats, elevation chart, explanation, GPX export button
- `src/map/layers.js` - Added CartoDB Dark Matter tile layer definition
- `src/map/map-manager.js` - Dark tiles as default, layer control for switching, clean attribution
- `src/app.js` - Full pipeline wiring: RoutePanel init, route rendering on generation-complete, route clear on generation-started
- `index.html` - Route panel container div, theme-color meta, viewport-fit=cover
- `styles/main.css` - Complete responsive design system: dark theme, mobile bottom sheet, desktop side panel, marker styles, Leaflet overrides
- `tests/map/route-renderer.test.js` - 4 tests for extractTurnPoints and addDistanceMarkers

## Decisions Made
- CartoDB Dark Matter as default tile layer (matches Stride dark theme #0A0A0A) with OSM as switchable alternative via Leaflet layer control
- Route layer group pattern: store all route-related layers (polyline, distance markers, turn markers) in map._strideRouteGroup for atomic clear and re-render
- Trail name extraction from ORS instruction text using regex matching 'onto/on/along {name}' patterns to implement EXPORT-04 local context requirement
- Mobile-first CSS approach: bottom sheet with 40vh max-height and drag handle on mobile, 380px fixed side panel on desktop at 768px breakpoint
- Removed Leaflet attribution prefix for cleaner mobile display
- Safe area inset support for notched phones via CSS env(safe-area-inset-bottom)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations worked on first attempt.

## User Setup Required

None - no external service configuration required.

## Checkpoint Pending

**Task 3 (human-verify)** awaits visual verification of the complete Phase 4 experience:
- Dark-themed map with gold route polyline
- Turn-by-turn markers and distance markers on the route
- Responsive route info panel with elevation chart and GPX export
- Mobile-responsive layout
- PWA install capability

## Known Stubs

None - all modules are fully implemented with real logic and data wiring.

## Next Phase Readiness
- Complete Phase 4 route display and export experience delivered
- All 3 Phase 4 plans complete (pending visual verification checkpoint)
- PWA infrastructure, route rendering, and export pipeline ready for production
- 303 tests passing, production build at 356KB gzipped to 116KB

## Self-Check: PASSED

All 8 created/modified files verified on disk. All 3 task commits verified in git history.

---
*Phase: 04-export-map-experience-and-pwa*
*Completed: 2026-03-27*
