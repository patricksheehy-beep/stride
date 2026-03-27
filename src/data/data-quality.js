/**
 * Trail data quality analysis utility.
 * Analyzes GeoJSON FeatureCollections returned from Overpass to detect
 * data-sparse regions and provide appropriate user feedback.
 *
 * Density thresholds:
 *   sparse:   0-5 features  — very limited trail data, route quality may suffer
 *   moderate: 6-25 features — partial coverage, some road segments likely
 *   rich:     26+ features  — good trail coverage, high-quality routes expected
 */

/**
 * Analyze the quality and density of trail data returned from Overpass.
 * Used to detect data-sparse regions and provide appropriate user feedback.
 *
 * @param {Object} geojson - GeoJSON FeatureCollection from OverpassAdapter
 * @returns {{ totalFeatures: number, density: string, highwayDistribution: Object, hasRouteRelations: boolean, message: string|null }}
 */
export function analyzeDataQuality(geojson) {
  const features = geojson?.features || [];
  const totalFeatures = features.length;

  // Count highway types
  const highwayDistribution = {};
  let hasRouteRelations = false;

  for (const feature of features) {
    const props = feature.properties || {};
    const highway = props.highway;
    if (highway) {
      highwayDistribution[highway] = (highwayDistribution[highway] || 0) + 1;
    }
    if (props.osmType === 'relation_member') {
      hasRouteRelations = true;
    }
  }

  // Classify density
  let density;
  let message;

  if (totalFeatures <= 5) {
    density = 'sparse';
    message = 'Very limited trail data available in this area. Route quality may be limited and the route may use roads more than usual.';
  } else if (totalFeatures <= 25) {
    density = 'moderate';
    message = 'Moderate trail coverage in this area. Routes will use available trails but may include some road segments.';
  } else {
    density = 'rich';
    message = null;
  }

  return { totalFeatures, density, highwayDistribution, hasRouteRelations, message };
}
