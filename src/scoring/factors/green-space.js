/**
 * Green space scoring factor.
 * Calculates what percentage of a route passes through green areas
 * (parks, forests, water bodies, nature reserves) using geometric
 * point-in-polygon testing at regular intervals along the route.
 *
 * Unlike scenic.js (which counts nearby features), this factor
 * performs true geometric intersection: sampling points along the
 * route and testing if they fall inside land-use polygons.
 *
 * Neutral base: 0.4 when no land-use data available (avoids
 * penalizing routes in data-sparse regions per DATA-04).
 */
import along from '@turf/along';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import length from '@turf/length';

const NEUTRAL_BASE = 0.4;
const SAMPLE_INTERVAL_KM = 0.1; // 100m sampling interval

/**
 * Score a route's green space coverage using geometric intersection.
 *
 * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection with LineString feature(s)
 * @param {Object|null|undefined} landUseFeatures - GeoJSON FeatureCollection of Polygon/MultiPolygon
 *   features representing parks, forests, water bodies, etc.
 * @returns {number} Score between 0 and 1 (0.4 neutral when no data)
 */
export function scoreGreenSpace(routeGeoJSON, landUseFeatures) {
  // No land-use data: return neutral score
  if (!landUseFeatures || !landUseFeatures.features || landUseFeatures.features.length === 0) {
    return NEUTRAL_BASE;
  }

  // No route features: return neutral score
  if (!routeGeoJSON.features || routeGeoJSON.features.length === 0) {
    return NEUTRAL_BASE;
  }

  // Extract the route LineString
  const routeFeature = routeGeoJSON.features[0];

  // Calculate route length in km
  const routeLength = length(routeFeature, { units: 'kilometers' });

  // Zero-length route: return neutral score
  if (routeLength === 0) {
    return NEUTRAL_BASE;
  }

  // Filter to only Polygon and MultiPolygon features
  const polygons = landUseFeatures.features.filter(
    f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );

  if (polygons.length === 0) {
    return NEUTRAL_BASE;
  }

  // Sample points every 100m along the route
  const totalSamples = Math.max(1, Math.floor(routeLength / SAMPLE_INTERVAL_KM));
  let greenSamples = 0;

  for (let i = 0; i <= totalSamples; i++) {
    const distanceKm = i * SAMPLE_INTERVAL_KM;
    const point = along(routeFeature, distanceKm, { units: 'kilometers' });

    // Check if this sample point falls inside any green polygon
    for (const poly of polygons) {
      if (booleanPointInPolygon(point, poly)) {
        greenSamples++;
        break; // Count once per sample point
      }
    }
  }

  // Calculate the ratio of green samples
  const greenRatio = greenSamples / (totalSamples + 1);

  // Scale: 0% green = 0.2, 100% green = 1.0
  return 0.2 + greenRatio * 0.8;
}
