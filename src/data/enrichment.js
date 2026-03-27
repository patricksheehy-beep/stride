/**
 * Data enrichment utilities for normalizing Overpass land-use data.
 * Converts closed LineString ways to Polygon geometry for point-in-polygon testing,
 * and filters out non-polygon features.
 */

/**
 * Normalize a GeoJSON FeatureCollection to contain only Polygon/MultiPolygon features.
 * Closed LineString ways (first coord == last coord, >= 4 coords) are converted to Polygon.
 * Open LineStrings and non-polygon types are filtered out.
 *
 * @param {Object} overpassGeoJSON - GeoJSON FeatureCollection from normalizeOverpassToGeoJSON
 * @returns {Object} GeoJSON FeatureCollection containing only Polygon/MultiPolygon features
 */
export function normalizeToPolygons(overpassGeoJSON) {
  const polygonFeatures = [];

  for (const feature of overpassGeoJSON.features) {
    const geomType = feature.geometry?.type;

    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      // Pass through existing polygon features unchanged
      polygonFeatures.push(feature);
    } else if (geomType === 'LineString') {
      const coords = feature.geometry.coordinates;

      // Must have at least 4 coordinates to form a valid polygon ring
      if (coords.length < 4) continue;

      // Check if the way is closed (first coord equals last coord)
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        // Convert closed LineString to Polygon
        polygonFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          },
          properties: { ...feature.properties }
        });
      }
      // Open LineStrings are filtered out (not a polygon)
    }
    // All other geometry types are skipped
  }

  return {
    type: 'FeatureCollection',
    features: polygonFeatures
  };
}
