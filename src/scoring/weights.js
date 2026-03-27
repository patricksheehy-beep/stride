/**
 * Configurable scoring weight profiles per region.
 * Weights determine the relative importance of each scoring factor
 * when computing the overall route quality score.
 *
 * Trail preference gets the highest default weight because it most
 * directly addresses ROUTE-04: preferring trails over roads.
 *
 * All weight profiles must sum to 1.0.
 */

/**
 * Default scoring weights (5 factors).
 * Trail preference (0.25) stays highest -- core differentiator.
 * Scenic reduced from 0.20 to 0.15 because greenSpace now handles
 * the geometric green measurement that scenic previously approximated
 * via feature counting.
 */
export const DEFAULT_WEIGHTS = {
  surface: 0.20,
  continuity: 0.20,
  trailPreference: 0.25,
  scenic: 0.15,
  greenSpace: 0.20
};

/**
 * Region-specific weight profiles (5 factors).
 * Each region adjusts weights based on local OSM data quality and
 * trail network characteristics. All profiles sum to 1.0.
 *
 * - japan:  Surface tagging is reliable, so surface weight is boosted.
 * - europe: Excellent trail networks with route relations, so trailPreference is boosted.
 * - us:     Sparse surface tagging, so continuity matters more.
 * - default: Balanced weights for unknown regions.
 */
export const REGION_WEIGHTS = {
  default: { ...DEFAULT_WEIGHTS },

  japan: {
    surface: 0.25,
    continuity: 0.15,
    trailPreference: 0.25,
    scenic: 0.15,
    greenSpace: 0.20
  },

  europe: {
    surface: 0.15,
    continuity: 0.15,
    trailPreference: 0.30,
    scenic: 0.20,
    greenSpace: 0.20
  },

  us: {
    surface: 0.15,
    continuity: 0.25,
    trailPreference: 0.25,
    scenic: 0.15,
    greenSpace: 0.20
  }
};

/**
 * Look up the weight profile for a given region key.
 * Falls back to DEFAULT_WEIGHTS for unknown regions.
 *
 * @param {string} regionKey - Region identifier ('japan', 'europe', 'us', 'default')
 * @returns {Object} Weight profile with keys: surface, continuity, trailPreference, scenic, greenSpace
 */
export function getWeightsForRegion(regionKey) {
  return REGION_WEIGHTS[regionKey] || DEFAULT_WEIGHTS;
}

/**
 * Merge NL-derived weight adjustments with region-detected defaults.
 * NL weights take priority for any key they specify. The result is
 * normalized to sum to 1.0.
 *
 * If nlWeights is null, undefined, or an empty object, the region
 * defaults are returned unchanged.
 *
 * @param {Object} regionWeights - Base weight profile from getWeightsForRegion()
 * @param {Object|null|undefined} nlWeights - Weight overrides from NLParser (partial or full)
 * @returns {Object} Merged and normalized weight profile (sums to 1.0)
 */
export function mergeWeights(regionWeights, nlWeights) {
  // If NL weights are absent or empty, return a copy of region defaults
  if (!nlWeights || typeof nlWeights !== 'object' || Object.keys(nlWeights).length === 0) {
    return { ...regionWeights };
  }

  // Start with region defaults
  const merged = { ...regionWeights };

  // Override with NL-derived values where the key exists in both
  for (const [key, value] of Object.entries(nlWeights)) {
    if (key in merged && typeof value === 'number') {
      merged[key] = value;
    }
  }

  // Normalize to sum to 1.0
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key of Object.keys(merged)) {
      merged[key] = merged[key] / sum;
    }
  }

  return merged;
}
