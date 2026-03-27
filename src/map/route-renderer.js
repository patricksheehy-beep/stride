/**
 * Route rendering on Leaflet map.
 * Draws route polylines, turn-by-turn instruction markers,
 * and distance markers at regular km intervals.
 */
import L from 'leaflet';
import turfAlong from '@turf/along';
import turfLength from '@turf/length';

/**
 * Extract turn-by-turn instruction points from an ORS GeoJSON response.
 * Maps each step's way_points[0] index to actual coordinates.
 *
 * @param {object|null} routeGeoJSON - ORS GeoJSON FeatureCollection
 * @returns {Array<{lat: number, lng: number, ele: number|undefined, instruction: string, distance: number, type: number}>}
 */
export function extractTurnPoints(routeGeoJSON) {
  if (!routeGeoJSON?.features?.length) return [];

  const feature = routeGeoJSON.features[0];
  const coordinates = feature.geometry?.coordinates || [];
  const steps = feature.properties?.segments?.[0]?.steps || [];

  if (!steps.length || !coordinates.length) return [];

  return steps.map(step => {
    const coordIndex = step.way_points?.[0] ?? 0;
    const coord = coordinates[coordIndex] || coordinates[0];
    return {
      lat: coord[1],
      lng: coord[0],
      ele: coord[2],
      instruction: step.instruction,
      distance: step.distance,
      type: step.type
    };
  });
}

/**
 * Render a route polyline on the map.
 * Clears any existing route layer group first.
 *
 * @param {L.Map} map - Leaflet map instance
 * @param {object} routeGeoJSON - ORS GeoJSON FeatureCollection
 * @param {object} [options={}] - Render options
 * @param {string} [options.color='#E8C547'] - Polyline color
 * @param {number} [options.weight=4] - Polyline weight
 * @param {number} [options.opacity=0.9] - Polyline opacity
 * @returns {L.LayerGroup} The route layer group
 */
export function renderRoute(map, routeGeoJSON, options = {}) {
  const { color = '#E8C547', weight = 4, opacity = 0.9 } = options;

  // Clear existing route
  clearRoute(map);

  // Create layer group
  const group = L.layerGroup().addTo(map);
  map._strideRouteGroup = group;

  // Extract coordinates and convert from [lng, lat] to [lat, lng] for Leaflet
  const coords = routeGeoJSON?.features?.[0]?.geometry?.coordinates || [];
  const latLngs = coords.map(c => [c[1], c[0]]);

  if (latLngs.length > 0) {
    const polyline = L.polyline(latLngs, { color, weight, opacity });
    group.addLayer(polyline);

    // Fit map to route bounds
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }

  return group;
}

/**
 * Add distance markers at regular km intervals along the route.
 *
 * @param {L.Map} map - Leaflet map instance
 * @param {object} routeFeature - GeoJSON Feature with LineString geometry
 * @param {number} [intervalKm=1] - Interval between markers in km
 * @returns {Array<L.Marker>} Array of distance marker instances
 */
export function addDistanceMarkers(map, routeFeature, intervalMi = 1) {
  const totalMi = turfLength(routeFeature, { units: 'miles' });
  const markers = [];

  if (totalMi < intervalMi) return markers;

  for (let mi = intervalMi; mi < totalMi; mi += intervalMi) {
    const point = turfAlong(routeFeature, mi, { units: 'miles' });
    const [lng, lat] = point.geometry.coordinates;

    const icon = L.divIcon({
      className: 'distance-marker',
      html: `<span>${mi} mi</span>`,
      iconSize: [32, 20]
    });

    const marker = L.marker([lat, lng], { icon });

    // Add to existing route layer group if available
    if (map._strideRouteGroup) {
      map._strideRouteGroup.addLayer(marker);
    } else {
      marker.addTo(map);
    }

    markers.push(marker);
  }

  return markers;
}

/**
 * Add turn-by-turn instruction markers at waypoints.
 *
 * @param {L.Map} map - Leaflet map instance
 * @param {Array<{lat: number, lng: number, instruction: string}>} turnPoints - From extractTurnPoints()
 * @returns {Array<L.CircleMarker>} Array of circle marker instances
 */
export function addTurnMarkers(map, turnPoints) {
  const markers = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let i = 0; i < turnPoints.length; i++) {
    const point = turnPoints[i];
    const letter = letters[i % 26];
    const cumulativeMi = point.distance ? (point.distance / 1609.34).toFixed(1) : '';

    const icon = L.divIcon({
      className: 'turn-marker',
      html: `<div class="turn-pin">${letter}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([point.lat, point.lng], { icon });
    const tooltip = `${letter}: ${point.instruction || ''}${cumulativeMi ? ` (${cumulativeMi} mi)` : ''}`;
    marker.bindTooltip(tooltip);

    if (map._strideRouteGroup) {
      map._strideRouteGroup.addLayer(marker);
    } else {
      marker.addTo(map);
    }

    markers.push(marker);
  }

  return markers;
}

/**
 * Clear the route layer group from the map.
 *
 * @param {L.Map} map - Leaflet map instance
 */
export function clearRoute(map) {
  if (map._strideRouteGroup) {
    map._strideRouteGroup.remove();
    map._strideRouteGroup = null;
  }
}
