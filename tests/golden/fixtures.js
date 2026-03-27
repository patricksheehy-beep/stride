/**
 * Golden test location fixtures for global validation.
 * Defines 22+ locations across 4+ continents with lat/lng,
 * expected region, expected trail types, and distance target.
 *
 * Categories:
 *   dense_urban   - City centers with high trail density
 *   suburban       - Park trails and suburban paths
 *   mountain       - Mountain/nature trail areas
 *   coastal        - Waterfront and coastal paths
 *   data_sparse    - Regions with limited OSM coverage
 */

/**
 * @typedef {Object} GoldenLocation
 * @property {string} name - Human-readable location name
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 * @property {string} expectedRegion - Region key from detectRegion()
 * @property {string[]} expectedTrailTypes - Highway types expected in the area
 * @property {number} distanceKm - Target route distance in kilometers
 * @property {string} category - Location category
 */

/** @type {GoldenLocation[]} */
export const GOLDEN_LOCATIONS = [
  // ── Dense urban (6) ─────────────────────────────────────────────
  {
    name: 'Tokyo, Japan',
    lat: 35.6762,
    lng: 139.6503,
    expectedRegion: 'japan',
    expectedTrailTypes: ['path', 'footway'],
    distanceKm: 8,
    category: 'dense_urban'
  },
  {
    name: 'London, UK',
    lat: 51.5074,
    lng: -0.1278,
    expectedRegion: 'europe',
    expectedTrailTypes: ['footway', 'path', 'cycleway'],
    distanceKm: 10,
    category: 'dense_urban'
  },
  {
    name: 'New York, US',
    lat: 40.7580,
    lng: -73.9855,
    expectedRegion: 'us',
    expectedTrailTypes: ['footway', 'path'],
    distanceKm: 8,
    category: 'dense_urban'
  },
  {
    name: 'Singapore',
    lat: 1.3521,
    lng: 103.8198,
    expectedRegion: 'southeast_asia',
    expectedTrailTypes: ['footway', 'path'],
    distanceKm: 5,
    category: 'dense_urban'
  },
  {
    name: 'Sao Paulo, Brazil',
    lat: -23.5505,
    lng: -46.6333,
    expectedRegion: 'south_america',
    expectedTrailTypes: ['footway', 'path'],
    distanceKm: 8,
    category: 'dense_urban'
  },
  {
    name: 'Nairobi, Kenya',
    lat: -1.2921,
    lng: 36.8219,
    expectedRegion: 'africa',
    expectedTrailTypes: ['footway', 'path', 'track'],
    distanceKm: 6,
    category: 'dense_urban'
  },

  // ── Suburban / park trails (5) ──────────────────────────────────
  {
    name: 'Munich suburbs, Germany',
    lat: 48.1351,
    lng: 11.5820,
    expectedRegion: 'europe',
    expectedTrailTypes: ['path', 'track', 'footway', 'cycleway'],
    distanceKm: 12,
    category: 'suburban'
  },
  {
    name: 'Portland, Oregon, US',
    lat: 45.5152,
    lng: -122.6784,
    expectedRegion: 'us',
    expectedTrailTypes: ['path', 'footway', 'track'],
    distanceKm: 10,
    category: 'suburban'
  },
  {
    name: 'Sydney suburbs, Australia',
    lat: -33.8688,
    lng: 151.2093,
    expectedRegion: 'oceania',
    expectedTrailTypes: ['footway', 'path', 'cycleway'],
    distanceKm: 10,
    category: 'suburban'
  },
  {
    name: 'Kyoto, Japan',
    lat: 35.0116,
    lng: 135.7681,
    expectedRegion: 'japan',
    expectedTrailTypes: ['path', 'footway', 'track'],
    distanceKm: 8,
    category: 'suburban'
  },
  {
    name: 'Santiago, Chile',
    lat: -33.4489,
    lng: -70.6693,
    expectedRegion: 'south_america',
    expectedTrailTypes: ['footway', 'path'],
    distanceKm: 10,
    category: 'suburban'
  },

  // ── Mountain / nature trails (5) ────────────────────────────────
  {
    name: 'Chamonix, Swiss Alps',
    lat: 45.9237,
    lng: 6.8694,
    expectedRegion: 'europe',
    expectedTrailTypes: ['path', 'track'],
    distanceKm: 15,
    category: 'mountain'
  },
  {
    name: 'Hakone, Japan',
    lat: 35.2324,
    lng: 139.1069,
    expectedRegion: 'japan',
    expectedTrailTypes: ['path', 'track'],
    distanceKm: 10,
    category: 'mountain'
  },
  {
    name: 'Boulder, Colorado, US',
    lat: 40.0150,
    lng: -105.2705,
    expectedRegion: 'us',
    expectedTrailTypes: ['path', 'track'],
    distanceKm: 12,
    category: 'mountain'
  },
  {
    name: 'Bariloche, Argentina',
    lat: -41.1335,
    lng: -71.3103,
    expectedRegion: 'south_america',
    expectedTrailTypes: ['path', 'track'],
    distanceKm: 10,
    category: 'mountain'
  },
  {
    name: 'Cape Town, South Africa',
    lat: -33.9249,
    lng: 18.4241,
    expectedRegion: 'africa',
    expectedTrailTypes: ['path', 'track', 'footway'],
    distanceKm: 12,
    category: 'mountain'
  },

  // ── Coastal (3) ─────────────────────────────────────────────────
  {
    name: 'Barcelona coast, Spain',
    lat: 41.3851,
    lng: 2.1734,
    expectedRegion: 'europe',
    expectedTrailTypes: ['footway', 'path', 'cycleway'],
    distanceKm: 8,
    category: 'coastal'
  },
  {
    name: 'Rio de Janeiro, Brazil',
    lat: -22.9068,
    lng: -43.1729,
    expectedRegion: 'south_america',
    expectedTrailTypes: ['footway', 'path', 'cycleway'],
    distanceKm: 10,
    category: 'coastal'
  },
  {
    name: 'Gold Coast, Australia',
    lat: -28.0167,
    lng: 153.4000,
    expectedRegion: 'oceania',
    expectedTrailTypes: ['footway', 'path', 'cycleway'],
    distanceKm: 8,
    category: 'coastal'
  },

  // ── Data-sparse (3) ─────────────────────────────────────────────
  {
    name: 'Rural Kenya',
    lat: -0.0236,
    lng: 37.9062,
    expectedRegion: 'africa',
    expectedTrailTypes: ['track', 'path'],
    distanceKm: 6,
    category: 'data_sparse'
  },
  {
    name: 'Patagonia, Argentina',
    lat: -50.3400,
    lng: -72.2648,
    expectedRegion: 'south_america',
    expectedTrailTypes: ['track'],
    distanceKm: 8,
    category: 'data_sparse'
  },
  {
    name: 'Central Mongolia',
    lat: 47.9138,
    lng: 106.9176,
    expectedRegion: 'default',
    expectedTrailTypes: ['track'],
    distanceKm: 5,
    category: 'data_sparse'
  }
];
