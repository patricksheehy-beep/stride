/**
 * Region detection and per-region scoring profiles.
 * Adapts trail discovery and scoring to local OSM tagging conventions.
 *
 * Japan: Favors highway=path with reliable surface tags.
 * Europe: Uses sac_scale, trail marking, and elaborate route relation networks.
 * US: Inconsistent tagging; check operator tags; sac_scale not widely used.
 * South America: Mixed tagging quality; continuity boosted for sparse areas.
 * Africa: Sparse surface tags; continuity highest to avoid dead ends.
 * Oceania: Balanced profile similar to default; good urban coverage.
 * Southeast Asia: Variable tagging quality; footway/path/pedestrian dominant.
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
  },

  south_america: {
    preferredHighways: ['footway', 'path', 'track', 'cycleway'],
    useSacScale: false,
    checkOperator: false
  },

  africa: {
    preferredHighways: ['track', 'path', 'footway'],
    surfaceTaggingReliable: false,
    sparseDataLikely: true
  },

  oceania: {
    preferredHighways: ['footway', 'path', 'cycleway', 'track'],
    useSacScale: false
  },

  southeast_asia: {
    preferredHighways: ['footway', 'path', 'pedestrian'],
    surfaceTaggingReliable: false
  }
};

/**
 * Detect the region for a given coordinate pair using bounding box checks.
 * Returns a region key that maps to a profile in regionProfiles.
 *
 * Detection order matters for overlapping bounding boxes:
 *   1. Japan (lat 24-46, lng 122-154) — checked first; overlaps southeast_asia lng range
 *   2. Europe (lat 35-72, lng -25 to 45)
 *   3. US (lat 24-50, lng -125 to -66)
 *   4. Southeast Asia (lat -11 to 28, lng 92-141) — after Japan to avoid misclassifying Japanese coords
 *   5. Oceania (lat -47 to -10, lng 113-179)
 *   6. South America (lat -56 to 13, lng -82 to -34)
 *   7. Africa (lat -35 to 37, lng -18 to 52)
 *   8. Default fallback
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Region key: 'japan' | 'europe' | 'us' | 'southeast_asia' | 'oceania' | 'south_america' | 'africa' | 'default'
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

  // Southeast Asia: lat -11 to 28, lng 92-141
  // Checked AFTER Japan since lng ranges overlap (122-141)
  if (lat >= -11 && lat <= 28 && lng >= 92 && lng <= 141) {
    return 'southeast_asia';
  }

  // Oceania: lat -47 to -10, lng 113-179
  if (lat >= -47 && lat <= -10 && lng >= 113 && lng <= 179) {
    return 'oceania';
  }

  // South America: lat -56 to 13, lng -82 to -34
  if (lat >= -56 && lat <= 13 && lng >= -82 && lng <= -34) {
    return 'south_america';
  }

  // Africa: lat -35 to 37, lng -18 to 52
  if (lat >= -35 && lat <= 37 && lng >= -18 && lng <= 52) {
    return 'africa';
  }

  return 'default';
}
