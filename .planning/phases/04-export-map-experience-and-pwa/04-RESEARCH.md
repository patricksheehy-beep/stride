# Phase 4: Export, Map Experience, and PWA - Research

**Researched:** 2026-03-27
**Domain:** GPX export, Leaflet map UX, elevation profiles, PWA offline, Web Workers
**Confidence:** HIGH

## Summary

Phase 4 transforms Stride from a developer tool into a production-ready PWA with three pillars: (1) GPX export compatible with Garmin Connect and Apple Watch, (2) an enhanced map experience with turn-by-turn waypoints, distance markers, elevation profiles, and mobile-friendly controls, and (3) full offline PWA capability with service worker caching and Web Worker-based scoring.

The critical discovery is that the current ORS adapter sets `elevation: false` (implicitly) and `instructions: false`. Both must be enabled before elevation profiles or turn-by-turn waypoints can work. ORS returns 3D coordinates `[lng, lat, elevation]` when `elevation: true` is set, and turn-by-turn step objects when `instructions: true` is set. This is the foundational change everything else depends on.

GPX generation should be hand-built as a simple XML string builder (not a library) -- the GPX 1.1 spec is straightforward XML, and a client-side generator from GeoJSON coordinates is under 100 lines. For the elevation profile chart, Chart.js 4.5.1 (~60KB, tree-shakeable) is the standard lightweight canvas solution -- no need for heavyweight d3-based Leaflet plugins. The PWA infrastructure (vite-plugin-pwa + Workbox) is already installed and partially configured; it needs manifest completion (icons, theme colors, offline fallback page) and runtime caching tuning.

**Primary recommendation:** Start by enabling ORS elevation + instructions data, then build outward -- GPX export, map waypoints/markers, elevation chart, mobile responsiveness, and finally PWA + Web Worker. Each layer depends on the enriched route data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | GPX file export compatible with Garmin, Apple Watch, GPS devices | GPX 1.1 XML spec documented; client-side generation from GeoJSON 3D coordinates; Garmin imports via Training > Courses; Apple Watch via WorkOutDoors app |
| EXPORT-02 | Responsive mobile map interface | Leaflet mobile tutorial patterns; CSS viewport meta already set; touch-friendly controls via Leaflet built-in tap/drag; bottom sheet UI pattern for route info |
| EXPORT-03 | Turn-by-turn waypoints with distance markers on map | ORS `instructions: true` returns step objects with maneuver type, distance, instruction text; render as Leaflet markers with custom icons |
| EXPORT-04 | Route explanations with local context (trail names, landmarks, surfaces, scenic highlights) | RouteExplainer already extracts trail metadata; enhance with ORS instruction street names and waypoint labels |
| EXPORT-05 | Elevation profile showing climbs, descents, total elevation gain | ORS `elevation: true` returns 3D coords [lng,lat,ele]; Chart.js 4.5.1 line chart with gradient fill; compute ascent/descent from coordinate deltas |
| ARCH-02 | Offline-capable PWA with service worker and app manifest | vite-plugin-pwa 1.2.x already installed; needs manifest icons, theme color update, offline fallback page, runtime caching for tiles + API responses |
| ARCH-03 | Scoring pipeline in Web Worker | Vite native Web Worker support via `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`; move scorer + turf imports to worker |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No backend:** PWA runs entirely client-side. API keys stored in localStorage. All export/processing must happen in-browser.
- **No framework:** Vanilla JS + Vite. No React/Vue/Svelte.
- **Leaflet 1.9.4:** Do NOT use Leaflet 2.0 alpha. Do NOT use MapLibre GL JS.
- **Individual @turf/* packages:** Do NOT import the full @turf/turf bundle.
- **vite-plugin-pwa manages Workbox:** Do NOT install Workbox separately.
- **idb for IndexedDB:** Do NOT use localForage.
- **Single developer:** Architecture must be understandable and maintainable.
- **Design system:** Dark theme (#0A0A0A bg), gold accent (#E8C547), Instrument Serif + DM Sans fonts.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Leaflet | 1.9.4 | Map rendering, route display, markers, controls | Installed |
| vite-plugin-pwa | 1.2.x | PWA manifest, service worker generation via Workbox | Installed |
| idb | 8.0.3 | IndexedDB wrapper for offline route storage | Installed |
| @turf/length | 7.3.4 | Distance calculations along routes | Installed |
| @turf/along | 7.3.4 | Points at distances along a line (for distance markers) | Installed |

### New Dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.1 | Elevation profile line chart | 60KB tree-shakeable, canvas-based, most popular JS charting library. No d3 dependency. Perfect for a single line chart with gradient fill. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js | @raruto/leaflet-elevation | Leaflet-elevation uses d3.js (~230KB), heavy for a single chart. Chart.js is lighter, more flexible styling, works standalone. |
| Chart.js | Custom Canvas | Possible for a simple area chart but Chart.js handles responsive resizing, tooltip interaction, and touch events out of the box. Under 100 lines of config vs 300+ custom. |
| Client-side GPX builder | ORS /gpx endpoint | ORS has a GPX response format, but using it requires a separate API call (costing rate limit), doesn't include our custom waypoint names/metadata, and doesn't work offline for cached routes. Client-side generation is simpler. |
| Client-side GPX builder | gpxjs/togpx npm packages | These packages are unmaintained (last update 2019-2021). GPX XML is simple enough to generate with template strings in ~80 lines. No dependency needed. |

**Installation:**
```bash
npm install chart.js
```

## Architecture Patterns

### New Module Structure
```
src/
  export/
    gpx-builder.js         # GeoJSON-to-GPX converter (new)
    download.js             # Blob download trigger (new)
  map/
    map-manager.js          # Enhanced: mobile viewport, layer switching (existing)
    layers.js               # Enhanced: dark tile layer option (existing)
    route-renderer.js       # Route polyline, waypoint markers, distance markers (new)
    elevation-chart.js      # Chart.js elevation profile (new)
  scoring/
    scoring-worker.js       # Web Worker for scoring pipeline (new)
    scorer.js               # Modified: postMessage interface for worker (existing)
  ui/
    route-panel.js          # Route info panel: distance, elevation, explanation (new)
    mobile-controls.js      # Touch-friendly generate button, distance selector (new)
  pwa/
    offline-page.html       # Fallback page when offline with no cache (new)
```

### Pattern 1: GPX Builder (GeoJSON to GPX XML)
**What:** Pure function that converts a GeoJSON FeatureCollection (with 3D coordinates from ORS) into a GPX 1.1 XML string.
**When to use:** When user clicks "Export GPX" for any route.
**Example:**
```javascript
// Source: GPX 1.1 spec (topografix.com/GPX/1/1/)
export function buildGPX(routeGeoJSON, metadata = {}) {
  const coords = routeGeoJSON.features[0].geometry.coordinates; // [lng, lat, ele]
  const name = metadata.name || 'Stride Route';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stride"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>${escapeXml(name)}</name></metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>`;

  for (const [lng, lat, ele] of coords) {
    xml += `\n      <trkpt lat="${lat}" lon="${lng}">`;
    if (ele !== undefined) xml += `<ele>${ele.toFixed(1)}</ele>`;
    xml += `</trkpt>`;
  }

  xml += `\n    </trkseg>\n  </trk>`;

  // Add waypoints for turn-by-turn cue points
  if (metadata.waypoints) {
    for (const wp of metadata.waypoints) {
      xml += `\n  <wpt lat="${wp.lat}" lon="${wp.lng}">`;
      if (wp.name) xml += `<name>${escapeXml(wp.name)}</name>`;
      if (wp.ele) xml += `<ele>${wp.ele.toFixed(1)}</ele>`;
      xml += `</wpt>`;
    }
  }

  xml += `\n</gpx>`;
  return xml;
}

function escapeXml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}
```

### Pattern 2: Blob Download Trigger
**What:** Creates a Blob URL and triggers download without a backend.
**When to use:** After GPX string is generated.
**Example:**
```javascript
// Source: MDN Blob API
export function downloadFile(content, filename, mimeType = 'application/gpx+xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Pattern 3: ORS Elevation + Instructions Enablement
**What:** Modify the ORS adapter request body to include `elevation: true` and `instructions: true`.
**When to use:** All ORS routing calls (both `route()` and `roundTrip()` methods).
**Why critical:** Without this, routes have no elevation data and no turn instructions. Everything in EXPORT-03 and EXPORT-05 depends on this.
**Example:**
```javascript
// Modified ORS request body
buildRequestBody(waypoints) {
  return {
    coordinates: waypoints.map(p => [p.lng, p.lat]),
    preference: 'recommended',
    units: 'km',
    geometry: true,
    elevation: true,          // NEW: enables 3D coords [lng, lat, ele]
    instructions: true,       // NEW: enables turn-by-turn steps
    instructions_format: 'text',
    options: {
      profile_params: {
        weightings: { green: { factor: 1.0 }, quiet: { factor: 1.0 } }
      }
    }
  };
}
// Response coordinates become: [[8.69, 49.42, 123.5], [8.70, 49.43, 130.2], ...]
// Response includes: features[0].properties.segments[0].steps[] with instruction, distance, duration
```

### Pattern 4: Web Worker with Vite ESM
**What:** Offload the scoring pipeline to a Web Worker using Vite's native worker support.
**When to use:** During route scoring (scorer.scoreAndRank call).
**Example:**
```javascript
// Source: Vite docs (vite.dev/guide/features#web-workers)
// scoring/scoring-worker.js
import { RouteScorer } from './scorer.js';

self.onmessage = function(e) {
  const { candidates, startPoint, weights } = e.data;
  const scorer = new RouteScorer(weights);
  const ranked = scorer.scoreAndRank(candidates, startPoint);
  self.postMessage(ranked);
};

// Usage in route-generator.js:
const worker = new Worker(
  new URL('../scoring/scoring-worker.js', import.meta.url),
  { type: 'module' }
);

function scoreInWorker(candidates, startPoint, weights) {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = (e) => reject(e);
    worker.postMessage({ candidates, startPoint, weights });
  });
}
```

### Pattern 5: Elevation Profile with Chart.js
**What:** Line chart showing elevation vs. distance along a route.
**When to use:** After route generation completes, displayed below or beside the map.
**Example:**
```javascript
// Source: Chart.js docs + Geoapify elevation tutorial pattern
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export function renderElevationChart(canvasId, coordinates) {
  // coordinates = [[lng, lat, ele], ...]
  let cumulativeDist = 0;
  const distances = [0];
  const elevations = [coordinates[0][2]];

  for (let i = 1; i < coordinates.length; i++) {
    // Approximate distance between consecutive points
    const dlat = coordinates[i][1] - coordinates[i-1][1];
    const dlng = coordinates[i][0] - coordinates[i-1][0];
    const segDist = Math.sqrt(dlat*dlat + dlng*dlng) * 111.32; // rough km
    cumulativeDist += segDist;
    distances.push(cumulativeDist);
    elevations.push(coordinates[i][2]);
  }

  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels: distances.map(d => d.toFixed(1)),
      datasets: [{
        data: elevations,
        fill: true,
        borderColor: '#E8C547',
        backgroundColor: 'rgba(232, 197, 71, 0.15)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Distance (km)', color: '#888' }, ticks: { color: '#888' } },
        y: { title: { display: true, text: 'Elevation (m)', color: '#888' }, ticks: { color: '#888' } }
      }
    }
  });
}
```

### Pattern 6: Distance Markers on Route
**What:** Place Leaflet markers at every 1km along the route using @turf/along.
**When to use:** After route is rendered on map.
**Example:**
```javascript
// Source: Turf.js docs
import along from '@turf/along';
import length from '@turf/length';

export function addDistanceMarkers(map, routeFeature, intervalKm = 1) {
  const totalKm = length(routeFeature, { units: 'kilometers' });
  const markers = [];

  for (let km = intervalKm; km < totalKm; km += intervalKm) {
    const pt = along(routeFeature, km, { units: 'kilometers' });
    const [lng, lat] = pt.geometry.coordinates;

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'distance-marker',
        html: `<span>${km}</span>`,
        iconSize: [24, 24]
      })
    }).addTo(map);
    markers.push(marker);
  }
  return markers;
}
```

### Anti-Patterns to Avoid

- **Anti-pattern: Using Leaflet Routing Machine for turn-by-turn display.** LRM is barely maintained, designed for interactive route creation (not display-only), and adds OSRM/Mapbox as a routing dependency. ORS already provides step instructions -- just render them directly.
- **Anti-pattern: Leaflet-elevation plugin for elevation charts.** Pulls in d3.js (~230KB), overkill for a single line chart. Chart.js is lighter and more flexible for custom theming.
- **Anti-pattern: GPX generation via ORS /gpx endpoint.** Costs an API call, doesn't work offline, and misses custom metadata like waypoint names and route explanations.
- **Anti-pattern: Calling structured clone on large GeoJSON in Web Worker postMessage.** The structured cloning of large coordinate arrays can be slow. For very large routes, consider transferring ArrayBuffers instead, but for typical running routes (hundreds of points) this is not needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart rendering | Custom canvas drawing + resize handlers | Chart.js 4.5.1 | Handles responsive resizing, retina displays, touch tooltips, animation. ~60KB tree-shakeable. |
| Service worker + manifest | Custom service worker from scratch | vite-plugin-pwa + Workbox | Already installed. Handles precaching, runtime strategies, manifest generation, update prompts. |
| File download in browser | Server-side download endpoint | Blob + URL.createObjectURL | Standard browser API, no backend needed, works offline. |
| Distance along a route line | Custom haversine accumulator | @turf/along | Already installed, handles edge cases (antimeridian, short segments). |

**Key insight:** GPX XML generation IS something to hand-build -- it is simple template string concatenation (~80 lines) and adding a library for it introduces a stale dependency for trivial value.

## Common Pitfalls

### Pitfall 1: ORS Elevation Data Missing
**What goes wrong:** Elevation profile shows flat line or NaN values.
**Why it happens:** ORS only returns 3D coordinates when `elevation: true` is explicitly set in the request body. The current ORS adapter does NOT set this.
**How to avoid:** Add `elevation: true` to BOTH `buildRequestBody()` and `roundTrip()` request bodies in `src/routing/adapters/ors.js`. Verify coordinates have 3 elements after the change.
**Warning signs:** `coordinates[0].length === 2` instead of `3` in the route response.

### Pitfall 2: ORS Instructions Not Returned
**What goes wrong:** No turn-by-turn data available for waypoint markers.
**Why it happens:** The current adapter sets `instructions: false`. ORS omits the `segments[].steps[]` array entirely when instructions are disabled.
**How to avoid:** Set `instructions: true` in both routing methods. The response will then include `features[0].properties.segments[0].steps[]` with `instruction`, `distance`, `duration`, `type`, and `way_points` (indices into the coordinate array).
**Warning signs:** `response.features[0].properties.segments` is undefined or has no `steps` array.

### Pitfall 3: GPX Waypoint Order for Garmin
**What goes wrong:** GPX file imports into Garmin Connect but shows no turn-by-turn cues.
**Why it happens:** Garmin Connect generates its own turn-by-turn from the track geometry when importing a GPX course. Separate `<wpt>` elements are treated as standalone POIs, not course points. Garmin uses its own routing engine to rebuild navigation from the track.
**How to avoid:** Focus on accurate `<trk><trkseg><trkpt>` data with elevation. Garmin's import handles navigation overlay. Optional `<wpt>` elements provide visual markers only.
**Warning signs:** Imported course shows on map but no navigation prompts on watch.

### Pitfall 4: Service Worker Caching Stale Routes
**What goes wrong:** User generates new routes but sees old cached results.
**Why it happens:** Runtime caching with StaleWhileRevalidate returns cached response first, then updates cache. If user navigates away before revalidation completes, stale data persists.
**How to avoid:** Use NetworkFirst for API responses (ORS, Overpass) so fresh data is preferred. Use CacheFirst only for static assets (tiles, fonts, icons). IndexedDB caching (already implemented) with TTL handles route freshness independently of the service worker.
**Warning signs:** Same routes appearing after clearing browser data but not IndexedDB.

### Pitfall 5: Web Worker Cannot Access DOM or Import Leaflet
**What goes wrong:** Worker crashes with "window is not defined" or "document is not defined".
**Why it happens:** Web Workers run in a separate thread with no DOM access. Leaflet, Chart.js, and any DOM-touching code cannot run in a worker.
**How to avoid:** Only move pure computation to the worker: scoring factors (surface, continuity, trail preference, scenic, green space) and Turf.js calculations. Keep map rendering, chart rendering, and DOM manipulation on the main thread.
**Warning signs:** `ReferenceError: window is not defined` in worker console.

### Pitfall 6: Chart.js Canvas Not Resizing on Mobile Orientation Change
**What goes wrong:** Elevation chart overflows or is tiny after phone rotation.
**Why it happens:** Canvas dimensions are set at initialization. Without `responsive: true` and proper container CSS, the chart doesn't adapt.
**How to avoid:** Set `responsive: true` and `maintainAspectRatio: false` in Chart.js options. Wrap canvas in a container with explicit height (e.g., `height: 200px`). The chart will fill the container width.
**Warning signs:** Chart renders once correctly but becomes distorted after resize/rotation.

### Pitfall 7: PWA Install Prompt Not Appearing
**What goes wrong:** "Add to Home Screen" prompt never fires on mobile browsers.
**Why it happens:** Missing required manifest fields (icons at 192px and 512px, start_url, display: standalone), or service worker not registered, or HTTPS not enabled (GitHub Pages provides HTTPS).
**How to avoid:** Verify manifest has all required fields. Test with Chrome DevTools > Application > Manifest. Use vite-plugin-pwa's generated manifest and verify icons exist in the build output.
**Warning signs:** Chrome DevTools > Application shows manifest errors or "no installable web app" warning.

## Code Examples

### Complete GPX Export Flow
```javascript
// Triggered by UI "Export GPX" button
import { buildGPX } from '../export/gpx-builder.js';
import { downloadFile } from '../export/download.js';

function handleExportGPX(routeResult) {
  const route = routeResult.route;
  const steps = route.features[0]?.properties?.segments?.[0]?.steps || [];
  const coords = route.features[0]?.geometry?.coordinates || [];

  // Build waypoints from ORS instruction steps
  const waypoints = steps
    .filter(step => step.instruction)
    .map(step => {
      const coordIdx = step.way_points[0]; // index into coordinate array
      const coord = coords[coordIdx];
      return {
        lat: coord[1],
        lng: coord[0],
        ele: coord[2],
        name: step.instruction
      };
    });

  const gpx = buildGPX(route, {
    name: `Stride ${routeResult.distanceKm?.toFixed(1)}km Route`,
    waypoints
  });

  downloadFile(gpx, `stride-route-${Date.now()}.gpx`);
}
```

### Elevation Stats Calculation
```javascript
// Source: Derived from ORS 3D coordinate format
export function calculateElevationStats(coordinates) {
  let totalAscent = 0;
  let totalDescent = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  for (let i = 0; i < coordinates.length; i++) {
    const ele = coordinates[i][2];
    if (ele === undefined) continue;

    minEle = Math.min(minEle, ele);
    maxEle = Math.max(maxEle, ele);

    if (i > 0) {
      const prev = coordinates[i - 1][2];
      if (prev !== undefined) {
        const diff = ele - prev;
        if (diff > 0) totalAscent += diff;
        else totalDescent += Math.abs(diff);
      }
    }
  }

  return { totalAscent, totalDescent, minEle, maxEle, elevationRange: maxEle - minEle };
}
```

### Mobile-Responsive Route Info Panel
```javascript
// Bottom sheet pattern for mobile, side panel for desktop
export function createRoutePanel() {
  const panel = document.createElement('div');
  panel.id = 'route-panel';
  panel.innerHTML = `
    <div class="route-panel-handle"></div>
    <div class="route-panel-content">
      <div class="route-stats">
        <div class="stat"><span class="stat-value" id="route-distance">--</span><span class="stat-label">km</span></div>
        <div class="stat"><span class="stat-value" id="route-ascent">--</span><span class="stat-label">m gain</span></div>
        <div class="stat"><span class="stat-value" id="route-descent">--</span><span class="stat-label">m loss</span></div>
      </div>
      <div class="elevation-chart-container">
        <canvas id="elevation-chart"></canvas>
      </div>
      <div class="route-explanation" id="route-explanation"></div>
      <button class="export-btn" id="export-gpx">Export GPX</button>
    </div>
  `;
  return panel;
}
```

### PWA Manifest Configuration (Updated for Design System)
```javascript
// vite.config.js - Updated manifest section
manifest: {
  name: 'Stride - AI Running Route Generator',
  short_name: 'Stride',
  description: 'Generate running routes that feel like a local recommended them',
  theme_color: '#0A0A0A',
  background_color: '#0A0A0A',
  display: 'standalone',
  scope: '/stride/',
  start_url: '/stride/',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}
```

### Workbox Runtime Caching (Updated)
```javascript
// vite.config.js - Updated workbox section
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  runtimeCaching: [
    {
      // Map tiles: cache-first (tiles don't change)
      urlPattern: /^https:\/\/.*tile.*\.(png|jpg)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    },
    {
      // API responses: network-first (prefer fresh data)
      urlPattern: /^https:\/\/(api\.openrouteservice|overpass-api|router\.project-osrm)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-responses',
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10
      }
    },
    {
      // Google Fonts
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }
      }
    }
  ],
  navigateFallback: 'index.html'
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3.js for elevation charts | Chart.js 4.x with tree-shaking | 2023-2024 | 60KB vs 230KB+ bundle. Canvas vs SVG. Better mobile perf. |
| Manual service worker | vite-plugin-pwa + Workbox 7 | 2024-2025 | Zero-config SW generation. No hand-written cache management. |
| importScripts() in workers | ESM `import` in module workers | 2023 | Workers can share ES modules with main thread. Vite handles bundling. |
| StaleWhileRevalidate for APIs | NetworkFirst with timeout | 2024 | Prevents stale data for dynamic APIs. Falls back to cache on timeout. |

**Deprecated/outdated:**
- `leaflet-routing-machine`: Barely maintained. Do not use for display-only route rendering.
- `togpx` / `gpxjs` npm packages: Last updated 2019-2021. GPX is simple XML -- build it.
- `Leaflet.Elevation` (MrMufflon): Archived. Use @raruto/leaflet-elevation if you must have a Leaflet plugin, but Chart.js is recommended instead.

## Open Questions

1. **OSRM Elevation Data**
   - What we know: ORS provides elevation via `elevation: true`. OSRM's public demo server does NOT return elevation data.
   - What's unclear: When ORS is down and OSRM fallback is used, routes will lack elevation. Should we show "elevation unavailable" in the UI, or use a separate elevation API (ORS has `/elevation/line` endpoint)?
   - Recommendation: Show "Elevation data unavailable" in the UI when coordinates are 2D. ORS elevation line endpoint costs an additional API call and may not be worth the rate limit cost. Accept graceful degradation.

2. **Apple Watch GPX Import Path**
   - What we know: Apple's native Workout app does NOT support GPX import for route navigation. Third-party apps like WorkOutDoors ($5.99) do.
   - What's unclear: Should EXPORT-01 "Apple Watch compatible" mean the GPX file works with WorkOutDoors, or should we note the limitation?
   - Recommendation: Generate standard GPX 1.1 that works with any compliant app. Document that Apple Watch requires a third-party app for GPX course navigation.

3. **Dark Tile Layer for Map**
   - What we know: Design system specifies dark theme (#0A0A0A bg). Standard OSM tiles are bright white.
   - What's unclear: Should we use a dark tile layer (CartoDB Dark Matter, Stamen Toner) or apply CSS filter invert to OSM tiles?
   - Recommendation: Add CartoDB Dark Matter as default tile layer (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`). Free, no API key, good contrast with gold route lines. Keep OSM as switchable alternative.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | Yes | v24.14.0 | -- |
| npm | Package management | Yes | 11.9.0 | -- |
| Vite | Build + Dev | Yes | 8.x | -- |
| vite-plugin-pwa | PWA generation | Yes | 1.2.x | -- |
| Leaflet | Map | Yes | 1.9.4 | -- |
| idb | Offline storage | Yes | 8.0.3 | -- |
| Chart.js | Elevation chart | No (needs install) | 4.5.1 | Custom canvas (more work) |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- Chart.js: needs `npm install chart.js` -- simple install, no blockers

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | GPX builder produces valid GPX 1.1 XML with trkpt/ele/wpt | unit | `npx vitest run tests/export/gpx-builder.test.js -t "gpx" --reporter=verbose` | Wave 0 |
| EXPORT-02 | Route panel renders correctly, viewport meta present | manual-only | Visual mobile testing | N/A |
| EXPORT-03 | Distance markers placed at correct intervals along route | unit | `npx vitest run tests/map/route-renderer.test.js -t "distance" --reporter=verbose` | Wave 0 |
| EXPORT-04 | Route explanations include trail names and context from metadata | unit | `npx vitest run tests/nl/route-explainer.test.js --reporter=verbose` | Existing |
| EXPORT-05 | Elevation stats calculation (ascent, descent, min, max) | unit | `npx vitest run tests/map/elevation-chart.test.js -t "stats" --reporter=verbose` | Wave 0 |
| ARCH-02 | Service worker registered, manifest valid, offline fallback works | manual-only | Chrome DevTools audit | N/A |
| ARCH-03 | Scoring worker produces same results as main thread scorer | unit | `npx vitest run tests/scoring/scoring-worker.test.js --reporter=verbose` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/export/gpx-builder.test.js` -- covers EXPORT-01 (GPX XML validation, coordinate accuracy, waypoint inclusion)
- [ ] `tests/map/route-renderer.test.js` -- covers EXPORT-03 (distance marker placement at intervals)
- [ ] `tests/map/elevation-chart.test.js` -- covers EXPORT-05 (elevation stats: ascent, descent, min/max)
- [ ] `tests/scoring/scoring-worker.test.js` -- covers ARCH-03 (worker produces identical results to main thread)

## Sources

### Primary (HIGH confidence)
- [GPX 1.1 Schema Documentation](https://www.topografix.com/GPX/1/1/) - XML element structure, required attributes, coordinate format
- [Vite Features - Web Workers](https://vite.dev/guide/features) - `new Worker(new URL(...), { type: 'module' })` syntax, production build behavior
- [vite-plugin-pwa Service Worker Precache](https://vite-pwa-org.netlify.app/guide/service-worker-precache) - globPatterns, registerType, offline configuration
- [vite-plugin-pwa Minimal Requirements](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html) - manifest icons, sizes, purpose fields
- [MDN - Define PWA App Icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons) - 192px, 512px, maskable, apple-touch-icon
- [Chart.js npm](https://www.npmjs.com/package/chart.js) - v4.5.1, 60KB bundle, tree-shakeable
- [ORS Directions API - Elevation Parameter](https://ask.openrouteservice.org/t/how-to-get-the-api-to-return-altitude/3563) - `elevation: true` returns [lng, lat, ele] coordinates
- [Leaflet Mobile Tutorial](https://leafletjs.com/examples/mobile/) - viewport meta, fullscreen map, touch handling
- [ORS Services](https://openrouteservice.org/services/) - Directions endpoints including /geojson and /gpx formats

### Secondary (MEDIUM confidence)
- [Garmin Connect GPX Import](https://support.garmin.com/en-US/?faq=wKuZXCaZRP4mWPX5aRz5h5) - Course import flow, turn-by-turn generation from track geometry
- [Geoapify Elevation Profile Tutorial](https://www.geoapify.com/tutorial/draw-route-elevation-profile-with-chartjs/) - Chart.js line chart pattern for route elevation
- [Vite + PWA Handling Offline Caching 2026](https://www.enjoytoday.cn/posts/vite-pwa-guide/) - NetworkFirst vs StaleWhileRevalidate for APIs, prompt vs autoUpdate
- [How to Upload GPX to Garmin/Apple Watch/COROS](https://www.seasonsrunclub.co.uk/blogs/news/how-to-upload-a-gpx) - Device compatibility for GPX courses
- [How to Favicon in 2026](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) - Minimal icon set for modern PWA

### Tertiary (LOW confidence)
- [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/) - Confirmed barely maintained; do not use
- [gpx.studio](https://gpx.studio/) - Confirms client-side GPX processing is viable in browser

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed except Chart.js; versions verified via npm
- Architecture: HIGH - Patterns follow established project conventions (EventBus, adapters, modular structure)
- Pitfalls: HIGH - Critical ORS elevation/instructions gap verified by reading source code directly
- GPX format: HIGH - GPX 1.1 spec is stable (unchanged since 2004), well-documented
- PWA config: HIGH - vite-plugin-pwa already partially configured; incremental changes
- Web Worker: MEDIUM - Vite ESM worker pattern is documented but moving Turf.js + scorer to worker needs careful structuredClone handling

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable technologies, no fast-moving targets)
