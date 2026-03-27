# Requirements: Stride

**Defined:** 2026-03-25
**Core Value:** Every generated route should feel like a local runner recommended it -- hitting the best trails, paths, and scenic spots in any location worldwide.

## v1 Requirements

### Route Generation

- [x] **ROUTE-01**: User can generate loop routes (not just out-and-back) for a requested distance
- [x] **ROUTE-02**: Generated route distance matches requested distance within 10% accuracy
- [x] **ROUTE-03**: User receives 3+ route options ranked by quality for each request
- [x] **ROUTE-04**: Routes are surface/terrain-aware -- preferring trails, paths, and unpaved surfaces when available
- [x] **ROUTE-05**: User can describe desired route in natural language ("shady waterfront trail", "hilly forest run")
- [x] **ROUTE-06**: Each route includes a quality explanation -- why this route was chosen and what makes it good
- [x] **ROUTE-07**: Multi-factor trail scoring ranks routes by green space proximity, water features, surface quality, trail continuity, and scenic value

### Data & Discovery

- [x] **DATA-01**: Overpass queries comprehensively fetch all trail types -- paths, footways, tracks, cycleways, and named routes -- using region-adaptive OSM tag sets
- [x] **DATA-02**: Routing engine prefers trails over roads -- uses ORS foot-hiking profile with waypoint-based trail forcing, OSRM as fallback only
- [x] **DATA-03**: Multi-source data fusion combines OSM trail geometry, route relations, land-use polygons, surface tags, and trail naming to approximate "where locals run"
- [x] **DATA-04**: Green space scoring calculates proximity to parks, nature reserves, water bodies, and tree cover for each route segment
- [x] **DATA-05**: Route generation adapts to global OSM tagging conventions -- works correctly in US, Europe, Japan, and regions with different tagging norms

### Export & Usability

- [ ] **EXPORT-01**: User can export any route as a GPX file compatible with Garmin, Apple Watch, and other GPS devices
- [ ] **EXPORT-02**: Map interface is fully responsive and usable on mobile devices
- [ ] **EXPORT-03**: Routes display turn-by-turn waypoints on the map with distance markers
- [ ] **EXPORT-04**: Route explanations include local context -- trail names, landmarks, surface types, scenic highlights
- [ ] **EXPORT-05**: Elevation profile is displayed for each route showing climbs, descents, and total elevation gain

### Architecture

- [x] **ARCH-01**: Codebase restructured from single index.html into ES Module architecture with clear component boundaries
- [ ] **ARCH-02**: App functions as an offline-capable PWA with service worker and app manifest
- [ ] **ARCH-03**: Scoring pipeline runs in a Web Worker to prevent UI blocking during route generation
- [x] **ARCH-04**: Trail data cached in IndexedDB to reduce redundant Overpass API calls and improve response time

### Global Validation

- [ ] **GLOBAL-01**: Golden test set of 20+ locations across 3+ continents validates route quality after every algorithm change
- [ ] **GLOBAL-02**: Region-adaptive OSM tag handling detects and adjusts for local tagging conventions automatically

## v2 Requirements

### Garmin Integration

- **GARMIN-01**: User can push routes directly to Garmin Connect via OAuth integration
- **GARMIN-02**: User can import Garmin activity history to inform route preferences

### Strava Integration

- **STRAVA-01**: User can connect Strava account to view activity heatmap overlay
- **STRAVA-02**: User can import Strava segments as route waypoints

### User Accounts

- **USER-01**: User can create account to save favorite routes
- **USER-02**: User can rate and review routes after running them
- **USER-03**: User route feedback improves scoring algorithm over time

### App Store

- **APP-01**: React Native rebuild for iOS/Android native distribution
- **APP-02**: App Store listing with screenshots and description

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time social features | Focus is route quality, not community -- adds complexity without improving core value |
| Payment/Stripe integration | Premature before route quality is proven globally |
| Strava heatmap as scoring input | Strava API terms prohibit third-party use of activity data in route generation; no public heatmap API |
| Self-hosted routing engine | Adds infrastructure complexity; ORS free tier (2000 req/day) sufficient for single-user prototype |
| Backend server | PWA constraint -- client-side only; API keys in localStorage for now |
| Real-time multiplayer routes | High complexity, no alignment with core value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-04 | Phase 1 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| ROUTE-01 | Phase 2 | Complete |
| ROUTE-02 | Phase 2 | Complete |
| ROUTE-03 | Phase 2 | Complete |
| ROUTE-04 | Phase 2 | Complete |
| ROUTE-07 | Phase 2 | Complete |
| ROUTE-05 | Phase 3 | Complete |
| ROUTE-06 | Phase 3 | Complete |
| DATA-03 | Phase 3 | Complete |
| DATA-04 | Phase 3 | Complete |
| EXPORT-01 | Phase 4 | Pending |
| EXPORT-02 | Phase 4 | Pending |
| EXPORT-03 | Phase 4 | Pending |
| EXPORT-04 | Phase 4 | Pending |
| EXPORT-05 | Phase 4 | Pending |
| ARCH-02 | Phase 4 | Pending |
| ARCH-03 | Phase 4 | Pending |
| GLOBAL-01 | Phase 5 | Pending |
| GLOBAL-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
