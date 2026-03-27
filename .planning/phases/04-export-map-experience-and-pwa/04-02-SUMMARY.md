---
phase: 04-export-map-experience-and-pwa
plan: 02
subsystem: infra
tags: [web-worker, pwa, service-worker, workbox, caching, offline]

# Dependency graph
requires:
  - phase: 02-scoring-and-route-building
    provides: RouteScorer multi-factor scoring pipeline with 5 weighted factors
  - phase: 01-modular-restructure
    provides: Vite build with vite-plugin-pwa, base module structure
provides:
  - ESM Web Worker wrapping RouteScorer for off-main-thread scoring
  - RouteGenerator with optional worker scoring and automatic fallback
  - Complete PWA manifest with dark theme, 3 icon sizes, offline support
  - NetworkFirst API caching strategy replacing StaleWhileRevalidate
  - CacheFirst Google Fonts caching
  - Offline fallback page with Stride branding
affects: [05-ui-overhaul, deployment, performance]

# Tech tracking
tech-stack:
  added: []
  patterns: [web-worker-with-fallback, esm-module-worker]

key-files:
  created:
    - src/scoring/scoring-worker.js
    - tests/scoring/scoring-worker.test.js
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/icons/icon-maskable-512.png
    - public/offline.html
    - scripts/generate-icons.cjs
  modified:
    - src/routing/route-generator.js
    - vite.config.js
    - index.html

key-decisions:
  - "ESM module worker (type: module) for Vite-compatible bundling of imports"
  - "30-second timeout on worker scoring to prevent UI hangs from crashed workers"
  - "Worker fallback is automatic and silent -- main thread scoring used when Worker unavailable"
  - "NetworkFirst for APIs with 10s timeout (was StaleWhileRevalidate) for fresher route data"
  - "Tile cache increased to 1000 entries (from 500) for better offline map coverage"
  - "Programmatically generated PNG icons using raw PNG encoding (no sharp/canvas dependency)"

patterns-established:
  - "Web Worker pattern: try Worker in constructor, catch to null, check before use in methods"
  - "Worker communication: postMessage({ data }) / onmessage with error wrapping"

requirements-completed: [ARCH-02, ARCH-03]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 04 Plan 02: Web Worker Scoring and PWA Completion Summary

**ESM Web Worker for off-main-thread route scoring with automatic fallback, plus complete PWA manifest with dark theme icons, NetworkFirst API caching, and offline fallback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T20:16:48Z
- **Completed:** 2026-03-27T20:21:25Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Scoring pipeline moved to Web Worker thread keeping UI responsive during Turf.js geometric calculations
- RouteGenerator automatically delegates scoring to worker with silent fallback to main thread
- PWA manifest completed with dark theme (#0A0A0A), all icon sizes including maskable, and proper metadata
- Service worker caching upgraded: NetworkFirst for APIs, CacheFirst for tiles (1000 entries) and Google Fonts
- Offline fallback page styled with Stride design system (gold on dark)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scoring Web Worker and integrate into RouteGenerator** - `bf2341e` (feat) [TDD]
2. **Task 2: Complete PWA manifest, icons, offline fallback, and caching** - `337699c` (feat)

## Files Created/Modified
- `src/scoring/scoring-worker.js` - ESM Web Worker wrapping RouteScorer with error handling
- `src/routing/route-generator.js` - Added _initWorker(), _scoreInWorker(), worker-first scoring with fallback
- `tests/scoring/scoring-worker.test.js` - Scoring determinism, sort order, empty handling, worker fallback tests
- `vite.config.js` - Complete PWA manifest, NetworkFirst APIs, CacheFirst fonts, navigateFallback
- `index.html` - Added apple-touch-icon link
- `public/icons/icon-192.png` - 192x192 PWA icon with gold background and dark "S"
- `public/icons/icon-512.png` - 512x512 PWA icon
- `public/icons/icon-maskable-512.png` - 512x512 maskable icon with safe area padding
- `public/offline.html` - Offline fallback page with Stride branding and retry button
- `scripts/generate-icons.cjs` - Node.js script for programmatic PNG icon generation

## Decisions Made
- ESM module worker (`type: 'module'`) for Vite-compatible bundling -- Vite handles imports in worker context
- 30-second timeout on worker scoring prevents indefinite hangs if worker crashes
- Worker initialization wrapped in try/catch for automatic null fallback in test/SSR environments
- NetworkFirst with 10s networkTimeoutSeconds for APIs -- fresher data than StaleWhileRevalidate, with fast offline fallback
- Tile cache increased from 500 to 1000 maxEntries for better offline map coverage
- Generated icons programmatically using raw PNG encoding (zlib + CRC32) to avoid sharp/canvas dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Web Worker scoring is ready for production use; UI will stay responsive during route generation
- PWA is installable with proper manifest, icons, and offline support
- All 299 tests pass with no regressions
- Build produces valid service worker with 13 precache entries

## Self-Check: PASSED

All 10 created/modified files verified present on disk. Both task commits (bf2341e, 337699c) verified in git log.

---
*Phase: 04-export-map-experience-and-pwa*
*Completed: 2026-03-27*
