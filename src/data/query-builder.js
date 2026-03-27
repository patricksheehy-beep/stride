/**
 * Comprehensive Overpass QL query builder for trail discovery.
 * Builds queries that capture ALL runnable way types globally,
 * including highways, route relations, and leisure features.
 *
 * This is the most critical data function in the pipeline --
 * incomplete queries mean missing trails for users.
 */

// All highway types relevant to runners/hikers
const highwayTypes = [
  'path',           // Generic non-motorized path (primary in Japan)
  'footway',        // Designated pedestrian way (primary in US/Europe)
  'track',          // Agricultural/forest roads (grade1-3 are runnable)
  'cycleway',       // Shared-use in many countries
  'pedestrian',     // Pedestrian zones in cities
  'bridleway',      // Foot access varies by country (yes in UK)
  'steps',          // Stairs (short segments, part of trail routes)
  'living_street'   // Residential areas with shared space
];

// Route relation types for named trail networks
const routeTypes = ['hiking', 'running', 'foot', 'fitness_trail'];

// Leisure features with runnable paths
const leisureTypes = ['track', 'nature_reserve'];

/**
 * Build a comprehensive Overpass QL query for trail discovery in a bounding box.
 * Queries all relevant highway types, route relations, and leisure features,
 * while excluding access-restricted ways.
 *
 * @param {number[]} bbox - Bounding box as [south, west, north, east]
 * @param {Object} [options={}] - Query options
 * @param {number} [options.timeout=300] - Overpass query timeout in seconds
 * @returns {string} Overpass QL query string
 */
/**
 * Build an Overpass QL query for land-use polygons in a bounding box.
 * Fetches parks, forests, water bodies, meadows, and other green/natural areas
 * as polygon geometry for downstream green space scoring.
 *
 * @param {number[]} bbox - Bounding box as [south, west, north, east]
 * @param {Object} [options={}] - Query options
 * @param {number} [options.timeout=60] - Overpass query timeout in seconds (lighter than trails)
 * @returns {string} Overpass QL query string
 */
export function buildLandUseQuery(bbox, options = {}) {
  const [south, west, north, east] = bbox;
  const timeout = options.timeout || 60;
  const bboxStr = `${south},${west},${north},${east}`;

  return `[out:json][timeout:${timeout}];
(
  way["leisure"~"^(park|garden|nature_reserve)$"]
     (${bboxStr});
  relation["leisure"~"^(park|garden|nature_reserve)$"]
           (${bboxStr});
  way["landuse"~"^(forest|grass|meadow|recreation_ground)$"]
     (${bboxStr});
  relation["landuse"~"^(forest|grass|meadow|recreation_ground)$"]
           (${bboxStr});
  way["natural"~"^(water|wood|grassland|wetland)$"]
     (${bboxStr});
  relation["natural"~"^(water|wood|grassland|wetland)$"]
           (${bboxStr});
  way["waterway"~"^(river|stream|canal)$"]
     (${bboxStr});
);
out body geom;`;
}

export function buildTrailQuery(bbox, options = {}) {
  const [south, west, north, east] = bbox;
  const timeout = options.timeout || 300;
  const bboxStr = `${south},${west},${north},${east}`;

  const highwayRegex = highwayTypes.join('|');
  const routeRegex = routeTypes.join('|');
  const leisureRegex = leisureTypes.join('|');

  return `[out:json][timeout:${timeout}][maxsize:536870912];
(
  way["highway"~"^(${highwayRegex})$"]
     ["access"!~"^(private|no)$"]
     ["foot"!~"^(private|no)$"]
     (${bboxStr});
  relation["route"~"^(${routeRegex})$"]
          (${bboxStr});
  way["leisure"~"^(${leisureRegex})$"]
     (${bboxStr});
);
out body geom;`;
}
