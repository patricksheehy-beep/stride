# Feature Landscape

**Domain:** Running / Cycling / Hiking Route Generation
**Researched:** 2026-03-25
**Competitors analyzed:** Strava Route Builder, Komoot, AllTrails, Garmin Connect, MapMyRun, Trail Router, Footpath, RunGo, PlotARoute

---

## Table Stakes

Features users expect. Missing any of these and the product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Map display with route overlay** | Users need to see their route visually on a real map. Every competitor does this. | Low | Stride already has this via Leaflet. Baseline met. |
| **Distance-based route generation** | "I want to run 5 miles" is the most fundamental input. Strava, Garmin, Trail Router, PlotARoute all offer this. | Medium | Stride already supports this. Distance accuracy is the hard part -- requested vs actual distance must be within ~5-10%. |
| **Round-trip / loop route generation** | Runners overwhelmingly want loops, not out-and-backs. Trail Router, Strava, Garmin Connect all generate loops from a starting point + distance. | High | This is THE core algorithm challenge. Trail Router generates candidate loops by searching for green waypoints; Strava uses heatmap popularity. Stride must nail loops that feel intentional, not random. |
| **Elevation profile display** | Runners need to see hills before committing to a route. Every serious competitor shows this. AllTrails, Komoot, Strava, Garmin -- all show elevation charts. | Low | Stride already uses ORS for elevation data. Display needs to be clear and prominent. |
| **Sport-type selection** | Running, cycling, hiking have different routing needs (speed, surface, road avoidance). Strava offers 7+ sport types. Komoot offers 8. | Medium | Stride's three modes (Trail, Sightseeing, Streets-OK) roughly map to this but use different terminology. Consider aligning with industry standard naming. |
| **Surface-type awareness** | Runners care deeply whether a route is paved, gravel, or dirt trail. Komoot shows surface breakdowns. Strava estimates surface type. | Medium | Depends on OSM surface=* tags, which are inconsistently applied globally. Must gracefully handle missing surface data rather than showing nothing. |
| **Starting point selection** | Users must pick where to start -- via map tap, address search, or current GPS location. Universal across competitors. | Low | Stride already has this via Nominatim geocoding + map interaction. |
| **GPX export** | The standard interchange format for routes. Every serious route planner exports GPX. This is how routes get onto Garmin watches, COROS, Suunto. | Low | Essential for watch users. Without GPX export, runners with GPS watches cannot use Stride-generated routes during their actual run. |
| **Multiple route options** | Users want to choose between 2-4 route alternatives, not accept a single suggestion. Strava generates multiple options. Garmin offers alternatives. | Medium | Generating 3 route candidates and letting the user pick is much better UX than a single take-it-or-leave-it route. Requires running the generation algorithm multiple times with different seed waypoints. |
| **Mobile-responsive design** | Most route planning happens on phones before a run. Strava rebuilt its Route Builder for mobile in 2025. | Medium | Stride is a PWA, which is good. But the UI must be designed mobile-first -- the map, controls, and route display must work well on a phone screen. |
| **Current location detection** | "Plan a route from where I am right now" is the default use case. All competitors detect GPS location. | Low | Standard browser geolocation API. Already available in most PWAs. |

---

## Differentiators

Features that set Stride apart. Not expected by default, but create competitive advantage when present.

### Tier 1: Core Differentiators (Stride's Identity)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Natural language route description** | "I want a 5-mile scenic trail run along water with gentle hills" -- users describe the *vibe* of their run, not just distance. No competitor does this well. Strava asks for distance + surface type. Trail Router asks for distance + green preference. Nobody lets you describe the *feeling* of a run. | High | This IS Stride's differentiator. LLMs can interpret "scenic waterfront," "quiet neighborhood streets," "hilly trail challenge," and translate that into waypoint selection + scoring weights. Recent research (PathGPT, LLMAP) confirms LLM-based route generation from natural language is feasible. |
| **"Local runner recommended" route quality** | Every route should feel like a local showed you around. This means: hitting the known scenic spots, using popular running paths, avoiding the road that looks fine on a map but is actually terrible to run on. No single competitor nails this holistically. | Very High | This requires layering multiple data signals: OSM trail data + popularity data (Strava heatmap or equivalent) + POI data + scoring that weights "route quality" over "shortest path." The algorithm must prefer the waterfront path over the parallel road, even if the road is shorter. |
| **Multi-source data fusion** | Combining OSM + popularity heatmaps + POI databases to fill each other's gaps. OSM has trail geometry but no popularity data. Strava has popularity but keeps it locked in their ecosystem. Google/Apple have POIs but not trail-level detail. Fusing these creates routes no single-source app can match. | Very High | This is Stride's data moat strategy. In data-sparse regions (rural Africa, parts of South America), one source alone fails. Layering sources means Stride degrades gracefully rather than producing garbage routes. |
| **Vibe-based route modes** | Beyond "trail vs road" -- modes like "scenic waterfront," "quiet neighborhood loop," "peak-bagger hill workout," "explore new area." These capture runner *intent* in ways that traditional surface/sport toggles cannot. | High | Maps to Stride's existing Trail / Sightseeing / Streets-OK modes but with much more nuance. The LLM interprets intent and adjusts scoring weights accordingly. |

### Tier 2: Strong Differentiators (Build After Core)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Route quality scoring with explanations** | Show *why* a route was chosen: "This route follows the Bay Trail waterfront path, avoids Highway 101 crossing, and hits Stevens Creek Trail -- popular with local runners." No competitor explains route reasoning. | Medium | LLM-generated explanations of route choices. Builds trust and helps users understand the route before running it. Also serves as a quality check -- if the explanation sounds wrong, the route probably is wrong. |
| **Popularity-weighted routing** | Use crowd activity data to prefer paths where runners actually run vs paths that merely exist on a map. Strava does this but only within their walled garden. Garmin does this with Trendline but only for Garmin watch owners. | High | Strava's API terms now prohibit using their data in AI models or third-party route generation. Alternative sources needed: OSM-traced heatmap data, publicly available running activity datasets, or building a proprietary activity dataset over time. |
| **Green space preference routing** | Trail Router's signature feature: routes that maximize time in parks, forests, and along water. Studies show runners strongly prefer green routes. | Medium | Trail Router's approach: 30m buffer around OSM ways, calculate intersection with green features (parks, forests, water), create a "green index" score per way segment. This is a proven technique and directly implementable with OSM data. |
| **Well-lit / safety-aware routing** | Route preference for well-lit streets, populated areas, and avoiding isolated segments. Critical for early-morning and evening runners, especially women (84% of female runners report experiencing harassment per Runner's World survey). | High | OSM has some lit=yes/no tags but coverage is sparse. Could combine: street type (residential vs industrial), proximity to commercial areas, OSM lighting tags where available. Trail Router already offers a "well-lit streets" preference toggle. |
| **Live GPS tracking during run** | Follow the route in real-time with your position shown on the map. RunGo and Footpath offer turn-by-turn voice navigation. | Medium | Stride already has live GPS tracking per PROJECT.md. Enhance with off-route detection and re-routing suggestions. |
| **Offline route access** | Download route + map tiles before running. Essential for trail runs with no cell service. RunGo, Footpath, AllTrails all offer offline support. | High | PWA service workers can cache route data and map tiles. Significant engineering effort for tile caching but critical for trail runners in remote areas. |

### Tier 3: Nice-to-Have Differentiators (Future Phases)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Points of Interest integration** | Show cafes, water fountains, restrooms, scenic viewpoints along or near the route. Strava added tappable POIs in 2025 with photos and ETAs. | Medium | Google Places API or OSM amenity data. Useful for longer runs. Strava's implementation includes community photos, elevation, distance, and ETA for each POI. |
| **Route sharing via URL** | Share a route with a friend via a simple link. No account required to view. | Low | Generate a shareable URL with route data encoded or stored. Aligns with PWA strengths (just a URL). |
| **Turn-by-turn voice navigation** | Audio cues like "turn left in 200 meters onto Bay Trail." RunGo's signature feature. Footpath added this in v4. | High | Requires significant engineering: route instruction generation, audio playback during activity, off-route detection. Nice-to-have, not table stakes for route generation. |
| **Trail condition reports** | Real-time info about mud, closures, flooding. AllTrails Peak ($80/yr) offers this. | Very High | Requires either crowd-sourced reporting (need users first) or integration with external condition data sources. Defer until significant user base exists. |
| **Route history and favorites** | Save routes you liked and re-run them. Basic but requires some form of local storage or account. | Low | localStorage can handle this for a PWA without accounts. Simple but valuable for repeat runners. |

---

## Anti-Features

Features to explicitly NOT build. These are traps that seem valuable but would hurt Stride or distract from its core value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Social feed / activity sharing** | PROJECT.md explicitly defers social features. Social features create massive engineering scope (accounts, feeds, privacy, moderation) and distract from route quality. Strava already owns this space -- competing on social is a losing battle. | Focus entirely on route quality. Let users export GPX and share routes via URL. Let Strava be the social layer. |
| **Training plans / coaching** | Strava, Garmin, TrainingPeaks own this domain. Building training plans requires sports science expertise and is orthogonal to route generation. | Stay focused: Stride generates great routes. Users use their existing training app for plans and Stride for "where should I run today?" |
| **User accounts / authentication** | PROJECT.md explicitly defers this. Accounts add friction to the core experience. A runner wants a route in 30 seconds, not a signup form. | Use localStorage for preferences and route history. Add accounts later ONLY if there is a clear feature that requires them (e.g., cross-device sync, community contributions). |
| **Payment / monetization (now)** | PROJECT.md defers Stripe. Premature monetization before route quality is proven globally will kill growth. | Validate route quality across diverse geographies first. Monetization comes after users say "I would pay for this." |
| **Full Strava OAuth integration** | Strava's updated API terms (2024-2025) prohibit using API data in AI models or displaying user data to other users. Legal risk is high. Engineering complexity is high. | Use Strava heatmap *visually* for OSM tracing (permitted by Strava's OSM agreement), but do NOT depend on Strava's API for core routing data. Build independent data sources. |
| **Native mobile app (React Native)** | PROJECT.md defers this. Rebuilding as a native app before the core algorithm works globally would be premature optimization of the wrong layer. | PWA is the right vehicle for now. PWAs can be installed to home screen, work offline, and access GPS -- all the capabilities Stride needs. |
| **Segment leaderboards / competitive features** | Strava owns segments. Competing on leaderboards requires massive user base and creates toxic competition dynamics that contradict the "enjoyable local run" vibe. | Stride is about discovery and quality, not competition. Let users find great routes; let Strava handle the racing. |
| **Wearable app (Garmin CIQ / WearOS)** | Enormous development effort for tiny screens. Route generation happens on a phone, not a watch. | Export GPX for watch navigation. The watch is a consumption device, not a route creation device. |

---

## Feature Dependencies

```
Natural language description --> LLM integration (Claude API)
                            --> Scoring formula (translates vibe to weights)
                            --> Multi-source data (needs data to score against)

Multi-source data fusion --> OSM/Overpass queries (geometry)
                        --> Popularity data source (scoring signal)
                        --> POI data source (waypoint candidates)
                        --> Scoring formula (combines signals)

Loop route generation --> Waypoint selection algorithm
                     --> Routing engine (ORS/OSRM)
                     --> Distance accuracy checking
                     --> Multiple candidate generation

GPX export --> Route geometry (lat/lng points from routing engine)
           --> Elevation data (from ORS)

Green space preference --> OSM land-use data (parks, forests, water)
                       --> Spatial intersection calculation
                       --> Scoring weight adjustment

Route quality scoring --> All data sources must be queryable
                      --> LLM for natural language explanation
                      --> Display UI for score breakdown

Offline access --> Service worker caching
              --> Map tile pre-download
              --> Route data serialization

Safety-aware routing --> OSM lighting/road-type tags
                     --> Time-of-day awareness
                     --> Scoring weight adjustment
```

### Critical Path

```
1. Loop route generation (foundation -- everything depends on generating good loops)
   |
2. Multi-source data fusion (data quality drives route quality)
   |
3. Scoring formula improvements (turn data into route intelligence)
   |
4. Natural language input (the UX layer that makes Stride feel different)
   |
5. GPX export (enables real-world usage)
   |
6. Multiple route options (user choice improves satisfaction)
```

---

## MVP Recommendation

### Must Have for Launch (Table Stakes + Core Identity)

1. **Loop route generation that produces good loops** -- No dead ends, no zig-zags, routes that feel intentional. This is the #1 quality gate. If loops are bad, nothing else matters.
2. **Distance accuracy within 10%** -- Users who ask for 5 miles must get 4.5-5.5 miles.
3. **Map display with route overlay** -- Already exists, refine.
4. **Elevation profile** -- Already exists via ORS.
5. **Starting point selection** -- Address search + current location + map tap.
6. **Natural language route description (basic)** -- Even a simple version ("scenic trail run, 5 miles") that adjusts scoring weights is a powerful differentiator. Does not need to be perfect at launch.
7. **GPX export** -- Without this, runners with GPS watches cannot use Stride routes in the real world.
8. **Multiple route options (2-3 candidates)** -- Present alternatives so users can choose.

### Defer to Phase 2

- **Popularity-weighted routing** -- Requires solving the data source question (Strava API is restricted; need alternative).
- **Green space preference routing** -- Valuable but not blocking; can layer onto existing scoring.
- **Route quality explanations** -- Nice UX polish but not a launch blocker.
- **Offline route access** -- Important for trail runners but significant engineering scope.

### Defer to Phase 3+

- **Turn-by-turn voice navigation** -- Large effort, RunGo/Footpath already do this well.
- **POI integration** -- Nice but not core.
- **Safety-aware routing** -- Requires data sources that may not be available yet.
- **Trail condition reports** -- Requires user community.
- **Route sharing via URL** -- Quick win but deferred to avoid scope creep.

---

## Feature Prioritization Matrix

| Feature | User Impact | Differentiation | Complexity | Data Dependency | Priority |
|---------|-------------|-----------------|------------|-----------------|----------|
| Loop generation quality | Critical | Medium (expected but poorly done by competitors) | High | OSM + routing engine | P0 |
| Distance accuracy | Critical | Low (expected) | Medium | Routing engine | P0 |
| Natural language input | High | Very High (nobody does this) | High | LLM API | P0 |
| GPX export | High | Low (expected) | Low | Route geometry | P0 |
| Multiple route options | High | Medium | Medium | Algorithm + routing engine | P0 |
| Elevation profile display | Medium | Low (expected) | Low | ORS elevation data | P0 (already exists) |
| Multi-source data fusion | High | Very High | Very High | OSM + popularity + POI | P1 |
| Green space preference | Medium | High (Trail Router's signature) | Medium | OSM land-use data | P1 |
| Popularity-weighted routing | High | High | High | Needs new data source | P1 |
| Route quality explanations | Medium | Very High | Medium | LLM + route data | P1 |
| Offline route access | Medium | Medium | High | Service workers + tile caching | P2 |
| Well-lit / safety routing | Medium | High | High | OSM lighting tags (sparse) | P2 |
| POI integration | Low | Medium | Medium | Google Places or OSM amenity | P2 |
| Turn-by-turn navigation | Medium | Medium | High | Route instruction generation | P3 |
| Route sharing via URL | Low | Low | Low | URL encoding | P2 |
| Trail conditions | Low | Medium | Very High | User community needed | P3+ |

---

## Competitor Feature Analysis

### Feature Matrix

| Feature | Strava | Komoot | AllTrails | Garmin Connect | Trail Router | Footpath | RunGo | MapMyRun | **Stride (Target)** |
|---------|--------|--------|-----------|----------------|--------------|----------|-------|----------|---------------------|
| Distance-based generation | Yes | Yes | Yes | Yes | Yes | No (manual draw) | No | No (manual draw) | **Yes** |
| Loop/round-trip generation | Yes | Yes | Yes (Smart) | Yes | Yes | No | No | No | **Yes** |
| Popularity/heatmap routing | Yes (own data) | Yes (community) | Yes (community) | Yes (Trendline) | No | No | No | No | **Yes (multi-source)** |
| Natural language input | No | No | No | No | No | No | No | No | **Yes (core differentiator)** |
| Surface type display | Yes | Yes (detailed) | Limited | Limited | No | No | No | No | **Yes** |
| Green space preference | No | No | No | No | Yes (core) | No | No | No | **Yes** |
| Sport-specific routing | Yes (7 types) | Yes (8 types) | Yes (3 types) | Yes (4 types) | Running only | Multi-sport | Running | Running | **Yes (3 modes)** |
| GPX export | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Limited | **Yes** |
| Offline maps | No | Yes (premium) | Yes (Plus) | Yes | No | Yes (Elite) | Yes | No | **Planned (P2)** |
| Turn-by-turn nav | No | Yes | No | Yes (on watch) | No | Yes (Elite) | Yes (voice) | No | **Planned (P3)** |
| Route explanations | No | Limited | Community reviews | No | No | No | No | No | **Yes (P1)** |
| POIs on route | Yes (2025) | Yes (Highlights) | Yes (500K+) | Limited | No | No | Yes (curated) | No | **Planned (P2)** |
| Curated local routes | No (community) | Yes (community) | Yes (450K+) | No | No | No | Yes (verified) | No | **AI-generated** |
| Multiple route options | Yes | Yes | Yes (Smart) | Yes | Yes | No | No | No | **Yes** |
| Free tier | No ($99/yr) | Limited ($60/yr) | Limited ($36/yr) | Yes (with watch) | Yes (limited) | Limited ($24/yr) | Free (basic) | Free (basic) | **Yes (planned)** |
| Safety/lighting preference | No | No | No | No | Yes | No | No | No | **Planned (P2)** |
| Works globally | Yes | Yes | Yes (500K trails) | Yes | Yes | Yes | Limited (curated cities) | Yes | **Yes (target)** |

### Competitive Gaps (Opportunities for Stride)

1. **Nobody offers natural language route description.** Every competitor uses form-based inputs (dropdowns, sliders, distance fields). Stride's "describe your run" approach is genuinely novel.

2. **Nobody explains WHY a route was chosen.** Users get a route and must trust it blindly. Route quality explanations ("This route follows Stevens Creek Trail, used by 200+ local runners weekly") build trust and differentiate.

3. **Popularity data is siloed.** Strava's heatmap only works in Strava. Garmin's Trendline only works for Garmin users. There is no open, cross-platform popularity data source. Multi-source fusion could create a more complete picture than any single ecosystem.

4. **Route quality complaints are rampant.** Strava users complain about AI routes on busy roads, dead ends, and unsafe segments. Garmin users report dead ends and navigation inconsistencies. The bar for route quality is surprisingly low -- doing it well is a real differentiator.

5. **Most route planners are manual, not generative.** MapMyRun, Footpath, and PlotARoute require users to manually draw routes. Strava and Garmin generate routes but with limited inputs. Stride's generative approach (describe what you want, get a route) is closer to what users actually want.

6. **Trail Router is the closest competitor to Stride's vision** -- it generates loops of a specific distance, prefers green spaces, uses OSM + ORS. But it has no natural language input, no popularity data, no multi-source fusion, and no route explanations.

### Data Source Comparison

| Data Source | Used By | Type | Access | Notes |
|-------------|---------|------|--------|-------|
| OpenStreetMap (Overpass) | All competitors | Trail geometry, surface, land use | Free, open | Quality varies by region. Excellent in Japan/Europe, sparse in parts of Africa/South America. |
| Strava Global Heatmap | Strava only | Popularity/activity density | Restricted (visual only, no API for route gen) | 13T lat/lng points from 1B+ activities. Strava prohibits use in AI or third-party route generation. OSM tracing permitted. |
| Garmin Trendline | Garmin only | Popularity/activity density | Proprietary, Garmin ecosystem only | Billions of miles of Garmin Connect data. No third-party access. |
| OpenRouteService (ORS) | Trail Router, others | Routing + elevation | Free (2000 req/day) | Based on OSM data. Supports foot-hiking profile. |
| OSRM | Various | Routing | Free, self-hostable | Based on OSM data. Foot profile biases toward roads. |
| GraphHopper | Komoot (modified) | Routing | Free tier available | Highly customizable weightings. Komoot uses a heavily modified version. |
| Google Places API | Strava (POIs) | POIs, places | Paid API | Comprehensive global POI data but expensive at scale. |
| AllTrails Trail DB | AllTrails only | 450K+ curated trails | Proprietary | Community-verified with reviews and photos. Not accessible to third parties. |
| RunGo Route DB | RunGo only | Curated city routes | Proprietary | Verified by local run groups. Limited to curated cities. |
| Komoot Community | Komoot only | Highlights, tips | Proprietary | Community-submitted POIs and trail recommendations. |

### Key Insight on Data Sources for Stride

The most critical data gap is **popularity/crowd activity data**. OSM provides geometry; ORS/OSRM provides routing; elevation is available. But knowing where runners *actually run* -- which is the key signal for "local knowledge" feel -- requires activity data that Strava and Garmin hoard behind proprietary walls.

**Realistic options for Stride:**
1. **OSM trace data from Strava heatmap** -- Permitted for OSM contributions. Not directly usable in routing.
2. **Public GPX repositories** (Wikiloc, GPS-Tracks.com, OpenRunner) -- Public route uploads that indicate popular paths.
3. **OSM route=running relations** -- Named running routes mapped in OSM.
4. **Park and trail designation tags** -- OSM leisure=park, natural=water, etc. as proxies for "desirable to run near."
5. **Build proprietary data over time** -- As Stride users generate and run routes, their activity data (with consent) becomes Stride's crowd data moat.
6. **Proxy signals** -- Sidewalk presence, road classification, speed limits, and land-use tags in OSM can proxy for "runnability" even without activity data.

---

## How Competitors Achieve "Local Knowledge" Feel

| Competitor | Approach | Limitation |
|------------|----------|------------|
| **Strava** | Heatmap from 1B+ activities shows where people actually run | Locked in Strava ecosystem. Route Builder often picks popular *roads* not best *running* paths. |
| **Komoot** | Community "Highlights" (favorite spots) + sport-specific maps | Requires active community contribution. Less useful in areas without Komoot users. |
| **AllTrails** | 450K+ curated trails with reviews, photos, difficulty ratings | Focused on established trails, not ad-hoc running routes in neighborhoods. |
| **Garmin** | Trendline Popularity from Garmin users | Only for Garmin watch owners. No community curation. |
| **RunGo** | Manually curated routes by local running groups + hotel partners | Very limited geographic coverage. Depends on human curation that doesn't scale. |
| **Trail Router** | Algorithmic preference for green spaces + water | No crowd data. A park-adjacent road scores well even if nobody runs there. |

### What "Local Knowledge" Actually Means (for Stride's Algorithm)

A route that "feels like a local recommended it" has these qualities:

1. **Uses the good paths** -- The waterfront trail, not the parallel road. The shaded park path, not the exposed sidewalk.
2. **Avoids the bad segments** -- The road that technically connects but has no sidewalk. The trail that dead-ends at a fence. The path through an industrial area.
3. **Connects logically** -- A local runner's route flows naturally, not zig-zagging to hit a distance target.
4. **Hits the highlights** -- Scenic overlooks, beautiful bridges, iconic landmarks -- the spots a local would show a visiting runner.
5. **Respects local patterns** -- In Japan, riverbank paths are prime running. In San Francisco, it is the Embarcadero and Golden Gate. A truly "local" algorithm would weight these differently per geography.

---

## Sources

- [Strava Route Builder Features](https://partners.strava.com/resources/how-to-create-a-route-with-stravas-route-builder) -- Strava official
- [Strava 2025 AI Route Updates](https://gearjunkie.com/technology/strava-updates-2025-ai-routes) -- GearJunkie
- [Strava Innovation Features Press Release](https://press.strava.com/articles/strava-continues-to-accelerate-innovation-with-new-features-designed-for) -- Strava Press
- [Strava Heatmap Engineering](https://medium.com/strava-engineering/the-global-heatmap-now-6x-hotter-23fc01d301de) -- Strava Engineering Blog
- [Strava AI Route Complaints](https://communityhub.strava.com/strava-features-chat-5/ai-generated-route-generator-creates-lousy-routes-10052) -- Strava Community Hub
- [Strava API Agreement Updates](https://press.strava.com/articles/updates-to-stravas-api-agreement) -- Strava Press
- [Komoot Guide](https://www.bikeradar.com/advice/buyers-guides/guide-to-using-komoot) -- BikeRadar
- [Komoot Trail Running Review](https://leave-the-road-and.run/komoot-is-pure-magic-for-trail-running/) -- Leave the Road and Run
- [AllTrails Custom Routes](https://www.tomsguide.com/wellness/fitness/i-tried-alltrails-new-custom-routes-tool-and-its-a-game-changer-for-hikers-bikers-and-runners) -- Tom's Guide
- [AllTrails Peak Membership](https://techcrunch.com/2025/05/12/alltrails-debuts-a-80-year-membership-that-includes-ai-powered-smart-routes/) -- TechCrunch
- [Garmin Trendline Popularity Routing](https://www.garmin.com/en-US/garmin-technology/maps-for-smartwatches/trendline/) -- Garmin Official
- [Trail Router: How It Works](https://trailrouter.com/blog/how-trail-router-works/) -- Trail Router Blog
- [Trail Router on Hacker News](https://news.ycombinator.com/item?id=23802317) -- HN Discussion
- [RunGo App](https://www.rungoapp.com/) -- RunGo Official
- [Footpath Route Planner](https://footpathapp.com/) -- Footpath Official
- [7 Best Running Route Planners 2025](https://www.routific.com/blog/running-route-planner) -- Routific
- [10 Best Running Route Planners 2025](https://nextbillion.ai/blog/running-route-planners) -- NextBillion
- [OSM Routing Wiki](https://wiki.openstreetmap.org/wiki/Routing) -- OpenStreetMap
- [OSM Surface Tags](https://wiki.openstreetmap.org/wiki/Key:surface) -- OpenStreetMap
- [OSM Path Tags](https://wiki.openstreetmap.org/wiki/Tag:highway=path) -- OpenStreetMap
- [OSRM Project](https://project-osrm.org/) -- OSRM Official
- [OpenRouteService](https://openrouteservice.org/) -- ORS Official
- [PathGPT: LLM Route Recommendation](https://arxiv.org/abs/2504.05846) -- arXiv
- [LLMAP: LLM Multi-Objective Route Planning](https://liangqiy.com/publication/llmap_llm-assisted_multi-objective_route_planning_with_user_preferences/) -- Academic
- [CrowdPlanner: Crowd-Based Route Recommendation](https://zheng-kai.com/paper/icde_2014_su.pdf) -- ICDE 2014
- [Women Runner Safety Survey](https://www.womensrunning.com/gear/tech-wearables/safety-apps-can-keep-track-of-your-whereabouts/) -- Women's Running
