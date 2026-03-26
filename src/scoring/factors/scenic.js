/**
 * Scenic value scoring factor.
 * Scores routes based on proximity to water features, green spaces,
 * and membership in named trail relations from OSM data.
 *
 * Three sub-signals:
 *   (a) Water proximity:  weight 0.4 -- natural=water, waterway=*, water-related names
 *   (b) Green proximity:  weight 0.3 -- leisure=park/garden, landuse=forest/grass, natural=wood
 *   (c) Named trail bonus: weight 0.3 -- features with routeType (relation members)
 *
 * Base score when no scenic indicators found: 0.3
 * This avoids penalizing routes in data-sparse regions.
 */

/** Water-related name patterns (case-insensitive) */
const WATER_NAME_PATTERNS = /\b(river|creek|lake|pond|stream|canal)\b/i;

/** Water feature property checks */
const WATER_NATURAL_VALUES = new Set(['water']);
const WATER_WATERWAY_VALUES = new Set(['stream', 'river', 'canal']);

/** Green feature property checks */
const GREEN_LEISURE_VALUES = new Set(['park', 'garden', 'nature_reserve']);
const GREEN_LANDUSE_VALUES = new Set(['forest', 'grass', 'meadow']);
const GREEN_NATURAL_VALUES = new Set(['wood', 'grassland']);

/**
 * Check if a feature is a water indicator.
 * @param {Object} props - Feature properties
 * @returns {boolean}
 */
function isWaterFeature(props) {
  if (props.natural && WATER_NATURAL_VALUES.has(props.natural)) return true;
  if (props.waterway && WATER_WATERWAY_VALUES.has(props.waterway)) return true;
  if (props.name && WATER_NAME_PATTERNS.test(props.name)) return true;
  return false;
}

/**
 * Check if a feature is a green space indicator.
 * @param {Object} props - Feature properties
 * @returns {boolean}
 */
function isGreenFeature(props) {
  if (props.leisure && GREEN_LEISURE_VALUES.has(props.leisure)) return true;
  if (props.landuse && GREEN_LANDUSE_VALUES.has(props.landuse)) return true;
  if (props.natural && GREEN_NATURAL_VALUES.has(props.natural)) return true;
  return false;
}

/**
 * Check if a feature is a named trail (relation member).
 * @param {Object} props - Feature properties
 * @returns {boolean}
 */
function isNamedTrail(props) {
  return !!props.routeType;
}

/**
 * Score a route's scenic value from available OSM data.
 *
 * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection (reserved for future use)
 * @param {Object} trailData - GeoJSON FeatureCollection of trail features with OSM properties
 * @returns {number} Score between 0 and 1 (0.3 base when no scenic data)
 */
export function scoreScenic(routeGeoJSON, trailData) {
  if (!trailData.features || trailData.features.length === 0) {
    return 0.3; // Base score for unknown scenic value
  }

  let waterCount = 0;
  let greenCount = 0;
  let namedTrailCount = 0;

  for (const feature of trailData.features) {
    const props = feature.properties || {};
    if (isWaterFeature(props)) waterCount++;
    if (isGreenFeature(props)) greenCount++;
    if (isNamedTrail(props)) namedTrailCount++;
  }

  // Sub-signal scores with saturation caps (each normalized to 0-1)
  const waterSignal = Math.min(waterCount / 3, 1.0);
  const greenSignal = Math.min(greenCount / 5, 1.0);
  const namedTrailSignal = Math.min(namedTrailCount / 4, 1.0);

  // Weighted combination of sub-signals (weights sum to 1.0)
  const rawScenic = waterSignal * 0.4 + greenSignal * 0.3 + namedTrailSignal * 0.3;

  // If no scenic indicators found, return base score
  if (rawScenic === 0) {
    return 0.3;
  }

  // Scale from base (0.3) to 1.0 based on scenic signals.
  // This ensures any scenic detection pushes the score above the base.
  const BASE = 0.3;
  const score = BASE + rawScenic * (1.0 - BASE);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}
