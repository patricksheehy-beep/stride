# Domain Pitfalls

**Domain:** Running route generation with OSM data, routing engines, trail scoring, multi-source data fusion, and global geospatial coverage
**Researched:** 2026-03-25
**Overall Confidence:** HIGH (corroborated across OSM wiki, routing engine docs, Trail Router post-mortem, academic research, and HN community discussions)

---

## Critical Pitfalls

Mistakes that cause rewrites, fundamentally broken routes, or "works in Bay Area but fails everywhere else" outcomes.

---

### Pitfall 1: Incomplete Overpass Tag Coverage (The "Missing Trail Types" Problem)

**What goes wrong:** Overpass queries that use a fixed list of highway tags (e.g., `highway=path`, `highway=footway`) miss large categories of runnable ways. OSM has at least 12 highway types relevant to runners: `path`, `footway`, `track`, `pedestrian`, `bridleway`, `cycleway`, `steps`, `living_street`, `residential`, `unclassified`, `service`, and `tertiary`. The prototype likely queries only a subset. Beyond highway tags, trails also exist as `route=hiking` and `route=running` relations that bundle multiple ways, `leisure=track` (athletic tracks), `leisure=nature_reserve` paths, and ways within `boundary=national_park`. Each region uses different tagging conventions -- Japan favors `highway=path` with `surface=*` tags, Europe uses `sac_scale` difficulty ratings, the US has inconsistent tagging where the same trail might be `footway` in one county and `path` in another.

**Why it happens:** OSM's tagging system is a folksonomy -- there is no enforced schema. The same physical trail can be tagged differently by different mappers in different regions. Developers typically start with obvious tags and never discover the long tail.

**Consequences:** Routes avoid excellent trails that exist in OSM but are invisible to the query. The system generates road-heavy routes in areas rich with trails. Users in regions with different tagging conventions get dramatically worse results.

**Prevention:**
- Build a comprehensive tag matrix covering all runnable highway types, not just `path` and `footway`
- Query `route=hiking` and `route=running` relations in addition to individual ways
- Include `highway=track` with `tracktype=grade1|grade2|grade3` (compacted surfaces suitable for running)
- Include `highway=cycleway` (shared-use paths are common in many countries)
- Include `highway=pedestrian` (pedestrian zones in cities)
- Add `leisure=track` for athletic running tracks
- Test queries against Overpass Turbo in 10+ diverse cities worldwide before finalizing
- Create a "tag coverage audit" that compares your query results against all ways within a bbox to measure what percentage you are capturing

**Detection (warning signs):**
- Routes in a new region are unexpectedly road-heavy despite visible trails on the map
- Users report "I can see a trail on the map but the route ignores it"
- Running the same bbox query with `highway~"."` returns significantly more results than your filtered query

**Phase to address:** Phase 1 (Data Layer). This is foundational -- every downstream component (scoring, routing, display) depends on having complete trail data.

---

### Pitfall 2: OSM Trail Fragmentation and Stitching Failures

**What goes wrong:** A single named trail (e.g., Bay Trail) exists in OSM as dozens or hundreds of disconnected way segments with gaps of 50m to 15km between them. The `connectSegments()` function in the prototype uses a 300m gap tolerance, but this is simultaneously too small (misses real connections) and too large (connects unrelated segments). Gaps occur because: (a) different mappers mapped different sections at different times, (b) trails cross parcels with different landowners, (c) physical gaps exist (road crossings, bridges, private property), (d) relations that should group these ways are broken or incomplete.

**Why it happens:** OSM is crowd-sourced. Trail mapping is done piecemeal. The OSM Relation Analyzer shows that hiking relations frequently have gaps, out-of-order ways, and miniature unmapped sections. Inexperienced editors routinely break relations during general editing.

**Consequences:** Routes have dead-end segments that force backtracking. The stitching algorithm connects unrelated trails creating illogical routes. Users are routed onto a trail, hit a dead end, and must backtrack to a road.

**Prevention:**
- Do NOT attempt to stitch raw OSM ways yourself -- instead, use a routing engine (ORS/OSRM/Valhalla) that already has a connected graph built from all OSM data
- Use OSM ways for *scoring and discovery* (finding which trails exist nearby) but use the routing engine for *path construction* (connecting waypoints into a continuous route)
- When using relations, check continuity: verify that the end node of way N matches the start node of way N+1
- Implement gap classification: <50m = likely crosswalk/bridge (safe to route through), 50-500m = investigate (might be unmapped connector), >500m = separate trail segments (do not stitch)
- Query `route=hiking` relations and use their member ordering to understand intended trail continuity

**Detection:**
- Routes contain sudden direction reversals (backtracking)
- Generated routes have segments with no matching OSM way underneath
- Distance calculations show large discrepancies between crow-flies and routed distance for a single trail

**Phase to address:** Phase 1 (Data Layer) for discovery, Phase 2 (Routing) for route construction. The key insight is separating "what trails exist" from "how to connect them."

---

### Pitfall 3: Routing Engine Road Bias (OSRM/ORS Foot Profile Favors Roads Over Trails)

**What goes wrong:** Both OSRM and ORS foot-walking/foot-hiking profiles assign speed/weight values that inadvertently prefer paved roads over unpaved trails. OSRM's weight system computes `weight = length / rate`, preferring ways with low weight. Paved residential roads get higher speed rates than unpaved paths, so the shortest-time route goes on roads even when parallel trails exist. The ORS foot-hiking profile is better but still documented as "not making full use of hiking paths available in the data." Users request a trail run and get a road route.

**Why it happens:** Routing engines are optimized for practical navigation (getting from A to B efficiently), not recreational routing (maximizing trail time). Their profiles assign speeds based on expected walking pace, and paved surfaces are faster. The concept of "preference" (wanting trails regardless of speed) is foreign to shortest-path algorithms.

**Consequences:** Routes use roads even when parallel trails exist. Trail mode feels indistinguishable from road mode. Users lose trust in the app's core value proposition.

**Prevention:**
- Do NOT send start/end coordinates and expect the routing engine to find trails -- instead, use waypoints placed ON known trail segments to force the router through trails
- Pre-select trail waypoints using scored OSM data, then route between consecutive waypoint pairs
- Consider Valhalla over OSRM/ORS for trail routing -- Valhalla supports dynamic runtime costing where you can heavily penalize road segments, and GaiaGPS proved this works for trail applications
- If using ORS, use the `foot-hiking` profile (not `foot-walking`) and add avoid features for highways
- If using OSRM, a custom Lua profile is required to invert the speed preference (trails faster than roads) -- this requires self-hosting OSRM
- Consider GraphHopper, which Trail Router uses successfully with custom foot profiles that penalize non-green edges

**Detection:**
- Route stays on roads when zooming in shows parallel trails within 100m
- Generated route distance on roads exceeds 50% of total distance in areas with trail coverage
- Comparing route geometry against OSM trail geometry shows minimal overlap

**Phase to address:** Phase 2 (Routing Engine Integration). This is the single most impactful architectural decision: how to make the routing engine serve recreational preferences rather than navigation efficiency.

---

### Pitfall 4: Scoring Formula That Rewards Proximity Over Quality

**What goes wrong:** The scoring formula over-weights distance-from-user and under-weights quality signals like surface type, greenery, waterfront proximity, trail continuity, and popularity. Result: the nearest trail always wins, even if it is a short, disconnected gravel path next to a highway, while a beautiful 10km waterfront trail 2km away is ranked lower.

**Why it happens:** Proximity is the easiest signal to compute (haversine distance). Quality signals require additional data: surface tags from OSM (often missing), green space intersection (requires polygon queries), elevation profiles (requires DEM data), popularity (requires Strava or similar). Developers start with proximity because it "works" and never add the harder signals.

**Consequences:** Routes cluster around the user's starting point rather than reaching nearby great trails. The app generates mediocre nearby routes instead of excellent routes that require a short transit to reach.

**Prevention:**
- Define scoring as a weighted multi-factor formula from the start: `score = w1*trail_quality + w2*greenery + w3*continuity + w4*surface + w5*popularity - w6*proximity_penalty`
- Trail Router's approach: compute a "green index" as the fraction of a 30m buffer around each way that intersects with parks, forests, and water features. This is the gold standard for greenery scoring
- Continuity score: prefer longer connected segments over short fragments (length of connected segment / total requested distance)
- Surface score: `paved > compacted > gravel > ground > grass > mud` (configurable per activity type)
- Popularity score: Strava heatmap intensity if available, otherwise number of nearby POIs as proxy
- Proximity should be a threshold filter (within 5km), not a ranking factor

**Detection:**
- Best-scored routes are always the closest, never the best
- Routes ignore well-known scenic trails in the area
- Changing starting point by 500m dramatically changes route quality (over-sensitivity to proximity)

**Phase to address:** Phase 2 (Algorithm) after data layer is solid. Scoring requires clean trail data to be meaningful.

---

### Pitfall 5: "Works in Bay Area" Assumption (Locality Bias)

**What goes wrong:** Every parameter, threshold, heuristic, and tag list is tuned to Sunnyvale/Bay Area characteristics: dense OSM coverage, English tagging, abundant paths, flat terrain, well-connected trail networks, US tagging conventions. The system breaks when encountering: (a) sparse OSM regions (rural Africa, Southeast Asia), (b) different tagging schemas (Japan's `highway=path` emphasis, Europe's `sac_scale`, Czech Republic's `kct` colour-based system), (c) mountainous terrain where "flat" routing assumptions fail, (d) non-English place names and tag values, (e) regions where trails are not mapped but roads are.

**Why it happens:** The founder runs in Sunnyvale. All testing happens there. Parameters that "feel right" locally are actually encoding Bay Area geography. This is the most insidious pitfall because everything appears to work until someone tries it in Kyoto, the Alps, or rural Brazil.

**Consequences:** Japan trip (mentioned as a goal) produces poor routes. App fails silently -- it generates routes, but they are road-heavy, miss trails, or hit dead ends. No error messages, just bad quality.

**Prevention:**
- Define a "golden test set" of 20+ locations across 6 continents with expected characteristics:
  - Dense urban: Tokyo, London, NYC, Singapore
  - Suburban trails: Bay Area (reference), Munich suburbs, Sydney suburbs
  - Mountain trails: Swiss Alps, Japanese Alps, Andes, Rockies
  - Coastal paths: Amalfi Coast, Big Sur, Great Ocean Walk
  - Sparse data: Rural Kenya, Patagonia, Central Asia
  - Mixed terrain: Hong Kong (urban + mountain), Cape Town, Rio
- Run automated quality checks: "Does this location return at least N trail segments? Does scoring produce differentiated results? Does the route stay on trails for at least X% of distance?"
- Make ALL thresholds configurable, not hardcoded: gap tolerance, search radius, minimum segment length, scoring weights
- Treat tag coverage as a per-region configuration rather than a global constant

**Detection:**
- Route quality degrades dramatically outside Bay Area
- Overpass queries return zero results for certain regions
- Users in non-US countries report consistently poor routes

**Phase to address:** Should be addressed incrementally starting Phase 1, but formalized as a test suite in Phase 3 (Global Validation). The golden test set should be defined in Phase 1 and run after every algorithm change.

---

### Pitfall 6: Strava Heatmap Data Is Not Freely Available

**What goes wrong:** The project plan lists Strava heatmaps as a target data source for runner popularity. But as of November 2024, Strava updated its API agreement to prohibit third-party apps from displaying activity data to other users. Strava's terms explicitly prohibit using API data in AI models. The heatmap tiles require authenticated session cookies (CloudFront-Key-Pair-ID, CloudFront-Policy, CloudFront-Signature), not a standard API key. There is no public API for heatmap tile access. Commercial access requires purchasing a Strava Metro license. Scraping heatmap tiles violates Strava's ToS.

**Why it happens:** Strava progressively restricted data access over 2023-2024 due to privacy concerns (researchers demonstrated home address deanonymization via triangulation) and commercial interests. Many blog posts and tutorials reference pre-restriction access patterns that no longer work.

**Consequences:** A major planned data source is unavailable. Time spent building Strava integration is wasted. If scraping is attempted, Strava will block access and potentially pursue legal action.

**Prevention:**
- Remove Strava heatmap as a primary data source from the architecture
- Consider alternative popularity signals: OSM `route=*` relations (curated routes indicate popularity), Waymarked Trails API (aggregates marked hiking/running routes from OSM), user-contributed GPS tracks on OSM, Komoot public routes
- If runner popularity data is essential, consider collecting it from Stride's own users over time (opt-in, privacy-respecting)
- Keep Strava integration as an "if available" enhancement, not a dependency

**Detection:**
- API calls to Strava heatmap endpoints fail with 401/403
- Integration tests pass locally with cached data but fail in production
- Architecture depends on data source that requires ToS violation

**Phase to address:** Phase 1 (Architecture Planning). This must be decided before building the data layer to avoid building around an unavailable source.

---

### Pitfall 7: Distance Accuracy Illusion (Requested vs. Actual Route Distance)

**What goes wrong:** User requests a 10km run. The generated route is 7.5km or 13km. Distance errors compound from multiple sources: (a) haversine distance underestimates actual road/trail distance by 10-40% depending on route sinuosity, (b) elevation is not factored into distance (a 1km segment with 200m elevation gain is actually 1.02km of running distance), (c) routing engine returns a different path than expected between waypoints, (d) the iterative distance-matching algorithm does not converge (Trail Router's approach of adjusting directional distance in a loop requires careful threshold tuning).

**Why it happens:** Crow-flies distance between waypoints is used to estimate route distance during planning, but routed distance is always longer due to road curvature, detours, and elevation. The "circuity factor" (actual/straight-line distance) varies from 1.1 in grid cities to 2.0+ in mountainous terrain.

**Consequences:** Runners consistently get routes that are too long or too short. Training plans require accurate distances. Runners who request 10km and get 7km feel cheated; runners who get 13km feel exhausted. This is the most user-visible quality issue.

**Prevention:**
- Always compute distance from the actual routed geometry returned by the routing engine, never from waypoint-to-waypoint haversine
- Implement an iterative refinement loop: generate route, measure actual distance, adjust waypoints, re-route, repeat until within 5% of target
- Apply region-specific circuity factors as initial estimates (urban grid: 1.2, suburban: 1.4, mountain: 1.6-2.0) to get closer on the first iteration
- Include elevation-adjusted distance in the final calculation: `actual_distance = sqrt(horizontal_distance^2 + elevation_change^2)` for each segment
- Display both "route distance" and "estimated running distance (with elevation)" to users
- Set user expectations: "+/- 5% of requested distance" not exact

**Detection:**
- Users report "route said 10km but my watch says 8km"
- Generated routes consistently overshoot or undershoot requested distance
- Iterative loop fails to converge (oscillates) on certain route shapes

**Phase to address:** Phase 2 (Route Construction Algorithm). Distance accuracy is part of the core route building loop.

---

## Moderate Pitfalls

Issues that degrade quality significantly but do not require complete rewrites.

---

### Pitfall 8: API Key Exposure in Client-Side PWA

**What goes wrong:** ORS API keys, Claude API keys, and any future service keys stored in localStorage are visible to anyone who opens browser DevTools. Keys can be extracted, abused (exhausting rate limits), or used for unauthorized purposes. A single malicious user can drain the daily ORS quota of 2,000 requests.

**Prevention:**
- Accept this as a known limitation of the no-backend constraint
- Use ORS/OSRM public endpoints where possible (no key needed for OSRM demo server)
- Implement client-side request throttling to slow abuse
- Consider a minimal serverless proxy (Cloudflare Worker, Vercel Edge Function) that holds API keys server-side and rate-limits by IP -- this is lightweight enough to not count as "having a backend"
- For Claude API key specifically: this MUST be server-proxied -- Claude API keys give access to billing accounts

**Detection:**
- ORS quota exhausted unexpectedly
- Unauthorized usage appears in API dashboards

**Phase to address:** Phase 1 (Architecture). Decide early whether a thin proxy is acceptable within the "no backend" constraint.

---

### Pitfall 9: ORS Free Tier Rate Limits Hitting a Wall at Scale

**What goes wrong:** ORS free tier allows 2,000 direction requests/day and 40/minute. A single route generation might require 3-10 routing calls (main route + alternatives + distance refinement iterations). At 5 calls per route, the daily limit supports only ~400 route generations per day across ALL users globally.

**Prevention:**
- Cache routing results aggressively (same start/end/waypoints = same result)
- Minimize routing calls per route generation: batch waypoints into a single multi-waypoint request instead of point-to-point pairs
- Plan for self-hosted ORS (Docker) when usage exceeds free tier -- this eliminates limits entirely but requires a server
- OSRM demo server has no explicit daily limit but is not meant for production use
- Consider Valhalla (self-hostable, no rate limits, dynamic costing)
- Track usage daily and alert before hitting limits

**Detection:**
- 403 errors from ORS increasing
- Route generation starts failing mid-day
- Users report "route generation failed" errors in afternoon (after daily quota exhausted)

**Phase to address:** Phase 2 (Routing) for initial implementation, Phase 4 (Scale) for self-hosting transition.

---

### Pitfall 10: Round-Trip Route Generation Producing Ugly Shapes

**What goes wrong:** Circular/loop route algorithms produce routes that look like rectangles, figure-eights, or bowties instead of natural loops. Out-and-back routes have unnecessary detours or fail to reach a natural turnaround point. The "divide into 4 cardinal direction segments" approach (common in literature) produces geometric-looking routes that feel artificial.

**Prevention:**
- Use geographic features as waypoints, not cardinal directions: route to a park, along a waterfront, through a trail, and back via a different path
- Trail Router's improved approach: search for nearby green spaces and water features, plot waypoints along their perimeters, route through those waypoints
- Implement repetition avoidance: penalize edges already traversed (Trail Router's "visited edges hash set" approach)
- For out-and-back: identify the single best trail segment and route to its far end, then back. Do not try to make out-and-back into a loop
- Accept that some areas genuinely have limited loop options and an out-and-back is the correct answer

**Detection:**
- Routes have sharp 90-degree turns at waypoints
- Routes double back on themselves more than 20% of their length
- Route shape on the map looks geometric rather than organic

**Phase to address:** Phase 2 (Route Construction Algorithm).

---

### Pitfall 11: Leaflet Performance Degradation on Mobile with Route Overlays

**What goes wrong:** Leaflet creates many LatLng and Point objects during map interaction. With route GeoJSON overlays, garbage collection pauses of 100-600ms cause visible jank during panning and zooming on mobile. Memory leaks in Leaflet's `map.remove()` cause increasing memory consumption when generating multiple routes in a session. On mobile browsers, this leads to tab crashes after 5-10 route generations.

**Prevention:**
- Simplify route GeoJSON before rendering: use Douglas-Peucker simplification to reduce point count (most routes do not need sub-meter precision on a map)
- Remove previous route layers before adding new ones (explicitly call `layer.remove()` then `map.removeLayer()`)
- Avoid Leaflet's default SVG renderer for routes -- use Canvas renderer (`L.canvas()`) which is faster for lines
- Limit the number of route alternatives displayed simultaneously (2-3 max)
- Test on low-end Android devices (this is where issues appear first)

**Detection:**
- Map becomes laggy after generating 3+ routes
- Mobile browsers show "page unresponsive" warnings
- Memory usage in DevTools increases monotonically with route generation

**Phase to address:** Phase 3 (UI/UX Polish), but be aware of it during Phase 2 when building the route display pipeline.

---

### Pitfall 12: Elevation Data Quality and Inconsistency

**What goes wrong:** ORS provides elevation data, but elevation values come from SRTM data (90m resolution globally, 30m in US) which has known issues: (a) tree canopy height is included (forest areas show higher elevation than actual ground), (b) 90m resolution misses terrain features smaller than 90m, (c) bridges and overpasses show ground elevation not structure elevation, (d) coastal and water areas have noise. Different APIs return different elevation values for the same coordinate.

**Prevention:**
- Use elevation for relative comparison (this route is hillier than that route) not absolute measurement
- Smooth elevation profiles with a moving average to remove noise spikes
- Do NOT promise elevation accuracy better than +/- 10m
- For Japan specifically: Japan has 10m DEM data available through GSI (Geospatial Information Authority) -- consider using region-specific elevation sources where available

**Detection:**
- Elevation profiles show sudden spikes or drops that do not match terrain
- Flat routes show significant elevation gain
- Users report elevation numbers that do not match their GPS watch

**Phase to address:** Phase 2 (Routing) for basic elevation integration, Phase 3 for elevation profile quality.

---

## Minor Pitfalls

Issues that cause friction but have straightforward fixes.

---

### Pitfall 13: Overpass Query Timeout on Dense Urban Areas

**What goes wrong:** Overpass queries for trail/path data in dense cities (Tokyo, London, NYC) return massive amounts of data, exceeding the default 180-second timeout or 512MB memory limit. The query succeeds in suburban Sunnyvale but fails in central Tokyo.

**Prevention:**
- Always set explicit `[timeout:300][maxsize:536870912]` in Overpass queries
- Reduce search radius in dense areas: start with 2km radius, expand only if too few results
- Request only necessary tags: use `[out:json][out:skel]` to get geometry without metadata when metadata is not needed
- Use `out geom` instead of `out body` + separate geometry request to reduce API calls
- Cache Overpass results per-region with 24-hour TTL (trail data does not change hourly)
- Consider using multiple Overpass endpoints as fallbacks

**Detection:**
- Queries timeout in specific cities
- Response sizes exceed 5MB
- Query latency exceeds 30 seconds

**Phase to address:** Phase 1 (Data Layer).

---

### Pitfall 14: Access Restriction Tags Ignored (Routing Through Private Property)

**What goes wrong:** OSM ways tagged with `access=private`, `access=no`, `foot=no`, or `access=customers` are included in trail queries but are not legally runnable. Some trails are seasonally restricted (`access:conditional=no @ (Dec-Mar)`). The system generates routes through private property or closed areas.

**Prevention:**
- Filter out ways with `access=private`, `access=no`, `foot=no`, `foot=private` in Overpass queries
- Be aware that access defaults vary by country: in the UK, `highway=footway` implies public right of way; in the US, it may not
- Consider seasonal restrictions as a future enhancement, not MVP
- Display a disclaimer: "Verify local access rules before running"

**Detection:**
- Users report "this trail is on private property"
- Routes go through gated communities, military bases, or industrial areas

**Phase to address:** Phase 1 (Data Layer) for basic filtering, Phase 3 for region-specific access rules.

---

### Pitfall 15: Unicode and Non-Latin Character Handling in Place Names

**What goes wrong:** Geocoding (Nominatim) and trail names work well in English but break with Japanese (kanji/hiragana/katakana), Chinese, Korean, Arabic, Thai, and other scripts. Trail names may be in `name:ja` but not `name` or `name:en`. Search for "Takao-san" might not match the trail tagged only as "高尾山".

**Prevention:**
- Use `name:en` as display preference but search across all `name:*` variants
- Enable Nominatim's `accept-language` parameter for multi-lingual search
- Display trail names in the user's preferred language with original script as fallback
- Test geocoding with non-Latin inputs early

**Detection:**
- Searches for well-known trails in non-English countries return no results
- Trail names display as garbled text or empty strings

**Phase to address:** Phase 3 (Internationalization), but use UTF-8 everywhere from Phase 1.

---

## Technical Debt Patterns

Patterns that create compounding problems if not managed early.

| Pattern | Why It Compounds | Prevention |
|---------|-----------------|------------|
| Hardcoded thresholds (300m gap, 2km radius) | Every new region needs different values; manual tuning does not scale | Make all thresholds configurable with per-region defaults |
| Single Overpass query pattern | Different regions need different tag sets; one query cannot serve all | Build a query generator that takes region + activity type and produces appropriate query |
| Synchronous API chains | Overpass -> Score -> Route -> Display as sequential blocking calls; any timeout freezes the whole UI | Implement async pipeline with loading states and partial results |
| No caching layer | Same trail data fetched repeatedly; API quotas wasted; slow UX | Cache Overpass results in IndexedDB with 24-hour TTL; cache routing results by waypoint hash |
| Scoring weights embedded in code | Cannot A/B test or tune without code changes | Store scoring weights in a configuration object, eventually expose to advanced users |

---

## Integration Gotchas

Specific technical surprises when connecting Stride's components.

| Integration | Gotcha | Mitigation |
|-------------|--------|------------|
| Overpass -> ORS | Overpass returns OSM way IDs; ORS expects lat/lng coordinates. You cannot tell ORS "route along way 12345" | Extract representative coordinates from Overpass way geometry to use as ORS waypoints |
| ORS foot-hiking profile | ORS may route AROUND a trail (via road) even when a waypoint is ON the trail, due to snap-to-nearest-edge behavior | Place waypoints at trail intersections (nodes shared between ways) for reliable snapping |
| OSRM nearest service | OSRM snaps coordinates to the nearest routable edge, which may be a road 200m away instead of a trail 50m away, if the trail is not in OSRM's foot profile graph | Verify snap results before routing; if snapped point is >100m from requested point, the trail may not be in the routing graph |
| Claude API for sightseeing waypoints | Claude may suggest waypoints at locations with no runnable path (middle of a lake, inside a building, on a highway) | Validate every Claude-suggested waypoint against the OSM network: snap to nearest routable node and reject if >300m from suggestion |
| Nominatim geocoding | Nominatim returns a point (often centroid of an area), not a routable location. Geocoding "Golden Gate Park" returns the park center, which is not on any path | After geocoding, snap result to nearest runnable way within the area, not just nearest road |
| Leaflet + GeoJSON route display | Leaflet GeoJSON layer added but previous route layer not removed leads to visual clutter and memory leaks | Maintain a single route layer reference; clear before adding new route |

---

## Performance Traps

Where Stride will get slow, and why.

| Trap | Trigger | Impact | Fix |
|------|---------|--------|-----|
| Overpass cold query | First query in a new region, especially dense cities | 5-30 second wait, UI appears frozen | Show loading indicator with progress; cache results; consider pre-fetching nearby regions |
| Multiple sequential ORS calls | Route generation with 8+ waypoints, each routed separately | 3-8 seconds total latency at 400ms per call | Batch into single multi-waypoint request; parallelize independent segments |
| Iterative distance refinement | Loop that adjusts route to match target distance | 3-5 iterations x 1-2 seconds each = 5-10 second generation time | Use circuity factor estimate to get closer on first iteration; limit to 3 iterations; accept 10% tolerance |
| GeoJSON parsing on mobile | Large Overpass response (2MB+) parsed in main thread | UI freezes for 1-3 seconds | Parse in Web Worker; stream-parse if possible; reduce response size with `out:skel` |
| Leaflet re-render on route swap | Removing old route + adding new route triggers full layer redraw | Visual flicker, 200-500ms pause | Use opacity transition to crossfade between routes |

---

## Security Mistakes

Specific to Stride's architecture.

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Claude API key in localStorage | Anyone can extract and use the key, running up bills on the founder's account | MUST use a serverless proxy (Cloudflare Worker) for Claude API calls -- non-negotiable |
| ORS API key in source code | Key visible in GitHub Pages source | Store in localStorage (not source), rotate key if exposed |
| No input sanitization on geocoding | XSS via crafted place name that executes script when displayed | Sanitize all text from external APIs before rendering in DOM |
| No CORS awareness | Fetching APIs from different origins may fail on some browsers/configurations | Ensure all API endpoints support CORS or use JSONP fallback |
| GPS location shared without consent UX | Geolocation API requires permission, but app does not explain why or handle denial gracefully | Show clear explanation before requesting location; provide manual location entry as fallback |

---

## UX Pitfalls

Things that make the app feel broken even when the algorithm works correctly.

| Pitfall | User Perception | Fix |
|---------|-----------------|-----|
| Route generation takes 8+ seconds with no feedback | "App is frozen / broken" | Show progressive loading: "Finding trails..." -> "Scoring routes..." -> "Building route..." -> "Optimizing distance..." |
| Route on map does not match terrain (cuts through buildings on the base map) | "This route is wrong" | This is usually a zoom level issue -- route follows road network but low-zoom rendering makes it look wrong. Show route only at zoom 14+ or simplify at low zoom |
| Requested 10km, got 8.5km, no explanation | "Distance is inaccurate" | Show distance with explanation: "9.8km (closest loop route to your 10km target)" |
| Route generated but no turn-by-turn | "How do I follow this?" | At minimum, show waypoint markers with distances; turn-by-turn is Phase 4+ |
| GPS tracking drifts in urban canyons / tunnels | "App lost me" | Show accuracy radius on map; snap GPS to route when within 30m; alert when GPS accuracy >50m |
| No route generated (insufficient data) | "App does not work here" | Never show "No routes found" -- instead show "Limited trail data in this area. Here is the best route we could build:" with a road-based fallback |

---

## "Looks Done But Isn't" Checklist

Things that pass a quick demo but fail in real usage.

| Feature | Looks Done When | Actually Done When |
|---------|-----------------|-------------------|
| Trail discovery | Returns trails in Sunnyvale | Returns trails in 20+ test locations across 6 continents with correct tag coverage |
| Route scoring | Scores differentiate trails from roads | Scores correlate with actual runner preference (validated against Strava popularity or user feedback) |
| Distance accuracy | Route distance matches requested within 20% | Matches within 5% after iterative refinement, across flat AND hilly terrain |
| Route quality | Route follows trails on the map | Route has been actually run by a human and confirmed as logical, safe, and enjoyable |
| Global readiness | Works in 3 US cities | Works in Japan (founder's stated trip), Europe (dense trail networks), developing countries (sparse data), and mountain terrain |
| Routing engine integration | ORS returns a route between 2 points | ORS returns a trail-preferring route through 5+ waypoints with repetition avoidance and distance matching |
| Multi-source data | Queries Overpass successfully | Overpass data enriched with green space scoring, elevation, surface type, and continuity analysis |
| Offline capability | App loads offline (PWA cache) | Cached routes viewable offline, GPS tracking works offline, routes re-sync when online |
| Mobile performance | Works on developer's phone | Works on 3-year-old Android phone with 2GB RAM on 3G connection |

---

## Recovery Strategies

When things go wrong in production, how to recover.

| Failure | Recovery |
|---------|----------|
| Overpass API down / rate-limited | Fallback to cached data (IndexedDB); show "Using cached trail data, may not reflect latest changes" |
| ORS API quota exhausted | Fallback to OSRM demo server (lower quality but no quota); queue requests for next day |
| Route generation produces dead-end | Detect dead-end in post-processing (route endpoint >500m from start for loop routes); re-generate with different waypoints |
| User reports "route goes through private property" | Add a "report route issue" button that flags the specific way/segment; maintain a local blocklist of problematic OSM ways |
| Claude API unavailable (sightseeing mode) | Fallback to algorithmic waypoint selection using POI data from Overpass (tourism=*, amenity=*) |
| Mobile browser crashes during route generation | Implement route generation in progressive steps with intermediate saves; if page reloads, offer to resume from last saved state |

---

## Pitfall-to-Phase Mapping

| Phase | Primary Pitfalls to Address | Risk if Deferred |
|-------|---------------------------|------------------|
| **Phase 1: Data Layer & Architecture** | #1 (Tag Coverage), #2 (Fragmentation - discovery only), #5 (Golden Test Set - define it), #6 (Strava Unavailability), #8 (API Key Security), #13 (Query Timeout), #14 (Access Restrictions) | Everything downstream builds on bad data; architecture decisions cascade |
| **Phase 2: Routing & Algorithm** | #3 (Road Bias), #4 (Scoring Formula), #7 (Distance Accuracy), #9 (Rate Limits), #10 (Loop Shape), #12 (Elevation) | Routes feel like Google Maps walking directions, not a runner's recommendation |
| **Phase 3: Global Validation & Polish** | #5 (Full Global Testing), #11 (Leaflet Performance), #15 (Unicode/i18n), UX Pitfalls | App works in demo but fails for real runners in real locations |
| **Phase 4: Scale & Reliability** | #9 (Self-hosted Routing), #8 (Proxy Implementation), Recovery Strategies | App hits scaling wall at ~400 users/day |

---

## Sources

### Official Documentation
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OSM Highway=path Tag](https://wiki.openstreetmap.org/wiki/Tag:highway=path)
- [OSM Highway=footway Tag](https://wiki.openstreetmap.org/wiki/Tag:highway=footway)
- [OSM Hiking/Trails](https://wiki.openstreetmap.org/wiki/Hiking/Trails)
- [OSM Access Restrictions for Routing](https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Access_restrictions)
- [OSM Japan Tagging](https://wiki.openstreetmap.org/wiki/Japan_tagging)
- [OSM Relation Analyzer](https://ra.osmsurround.org/)
- [OSRM Profiles Documentation](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/profiles.md)
- [ORS API Restrictions](https://openrouteservice.org/restrictions/)
- [ORS Self-Hosting Guide](https://giscience.github.io/openrouteservice/run-instance/)
- [OSRM Snap Issue #770](https://github.com/Project-OSRM/osrm-backend/issues/770)
- [Overpass Timeout Issue #389](https://github.com/drolbr/Overpass-API/issues/389)
- [Leaflet Memory Leak Issue #5263](https://github.com/leaflet/leaflet/issues/5263)
- [MDN Geolocation watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- [Strava API Agreement Update](https://press.strava.com/articles/updates-to-stravas-api-agreement)
- [Strava Aggregated Data Privacy Controls](https://support.strava.com/hc/en-us/articles/360015677851-Aggregated-Data-Usage-Privacy-Controls)

### Technical Deep Dives
- [How Trail Router Works](https://trailrouter.com/blog/how-trail-router-works/) -- GREEN INDEX algorithm, repetition avoidance, round-trip routing, OSM data processing pipeline
- [Trail Router HN Discussion](https://news.ycombinator.com/item?id=23802317) -- Community-reported OSM coverage gaps, scoring failures, regional data quality issues
- [FOSS Routing Engines Overview](https://github.com/gis-ops/tutorials/blob/master/general/foss_routing_engines_overview.md) -- OSRM vs Valhalla vs GraphHopper comparison
- [OSRM vs Valhalla Comparison](https://github.com/Telenav/open-source-spec/blob/master/osrm/doc/osrm-vs-valhalla.md) -- Dynamic costing advantages of Valhalla
- [Valhalla Routing Engine HN Discussion](https://news.ycombinator.com/item?id=17001422) -- Real-world routing engine selection experiences
- [Circular Route Planning (Medium)](https://medium.com/@inzi.tahir/circular-route-planning-8e30125baa7d) -- Distance accuracy challenges in loop routes
- [Optimizing GeoJSON in Leaflet](https://dev.to/muhammad_tahirfarooq_12b/optimizing-geojson-rendering-performance-in-leafletjs-for-high-density-map-layers-59j3) -- Canvas renderer, WebGL, performance fixes

### Research Papers and Data Quality Studies
- [OSM Data Quality by Country (Nature Communications)](https://www.nature.com/articles/s41467-023-39698-6) -- 83% global road coverage, high heterogeneity
- [OSM Quality in Japan (Taylor & Francis)](https://www.tandfonline.com/doi/full/10.1080/10095020.2022.2085188) -- Peak names quality assessment
- [OSM Data Quality in China (Springer)](https://link.springer.com/chapter/10.1007/978-3-319-08180-9_14) -- 94% incomplete regions
- [Geospatial Conflation Challenges (MDPI)](https://www.mdpi.com/2220-9964/11/7/375) -- Multi-source data alignment problems
- [OSM Navigation Performance (Taylor & Francis)](https://www.tandfonline.com/doi/full/10.1080/19475683.2025.2468184) -- Framework for assessing OSM routing quality
