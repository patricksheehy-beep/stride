/**
 * Region detection and per-region scoring profiles.
 * Adapts trail discovery and scoring to local OSM tagging conventions.
 *
 * Japan: Favors highway=path with reliable surface tags.
 * Europe: Uses sac_scale, trail marking, and elaborate route relation networks.
 * US: Inconsistent tagging; check operator tags; sac_scale not widely used.
 * Default: Global fallback with comprehensive surface and network preferences.
 */

/**
 * Region-specific scoring and query profiles.
 * These don't change which highway types are queried (that's always comprehensive),
 * but they adjust scoring weights and metadata interpretation.
 */
export const regionProfiles = {
  default: {
    preferredSurfaces: [
      'asphalt', 'concrete', 'compacted', 'fine_gravel',
      'gravel', 'paving_stones', 'ground', 'dirt',
      'earth', 'grass', 'woodchips', 'tartan'
    ],
    avoidSurfaces: ['mud', 'sand', 'snow', 'ice', 'stepping_stones'],
    maxSacScale: 'demanding_mountain_hiking',
    networkPriority: ['iwn', 'nwn', 'rwn', 'lwn']
  },

  japan: {
    preferredHighways: ['path', 'footway', 'track', 'pedestrian'],
    surfaceTaggingReliable: true,
    nameFields: ['name:en', 'name:ja', 'name']
  },

  europe: {
    preferRelations: true,
    useSacScale: true,
    useTrailMarking: true,
    networkPriority: ['iwn', 'nwn', 'rwn', 'lwn']
  },

  us: {
    preferredHighways: ['path', 'footway', 'track', 'cycleway'],
    checkOperator: true,
    useSacScale: false
  }
};

/**
 * Detect the region for a given coordinate pair using bounding box checks.
 * Returns a region key that maps to a profile in regionProfiles.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Region key: 'japan', 'europe', 'us', or 'default'
 */
export function detectRegion(lat, lng) {
  // Japan: lat 24-46, lng 122-154
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154) {
    return 'japan';
  }

  // Europe: lat 35-72, lng -25 to 45
  if (lat >= 35 && lat <= 72 && lng >= -25 && lng <= 45) {
    return 'europe';
  }

  // US: lat 24-50, lng -125 to -66
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) {
    return 'us';
  }

  return 'default';
}
