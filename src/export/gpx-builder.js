/**
 * GPX 1.1 XML builder for route export.
 * Converts GeoJSON FeatureCollection (from ORS) to GPX format
 * with track points, elevation data, and optional waypoints.
 */

/**
 * Escape XML special characters in a string.
 * @param {string} str - Input string
 * @returns {string} XML-safe string
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a GPX 1.1 XML string from a GeoJSON FeatureCollection.
 *
 * @param {object} routeGeoJSON - GeoJSON FeatureCollection with LineString geometry.
 *   Coordinates can be [lng, lat] (2D) or [lng, lat, ele] (3D).
 * @param {object} [metadata={}] - Optional metadata
 * @param {string} [metadata.name] - Route name
 * @param {Array<{lat: number, lng: number, ele?: number, name?: string}>} [metadata.waypoints] - Waypoint list
 * @returns {string} GPX 1.1 XML string
 */
export function buildGPX(routeGeoJSON, metadata = {}) {
  const { name, waypoints } = metadata;

  // Extract coordinates from the first feature's geometry
  const coords = routeGeoJSON?.features?.[0]?.geometry?.coordinates || [];

  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="Stride" ';
  gpx += 'xmlns="http://www.topografix.com/GPX/1/1" ';
  gpx += 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
  gpx += 'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">';
  gpx += '\n';

  // Metadata
  gpx += '  <metadata>\n';
  gpx += `    <name>${escapeXml(name || 'Stride Route')}</name>\n`;
  gpx += '  </metadata>\n';

  // Track
  gpx += '  <trk>\n';
  gpx += `    <name>${escapeXml(name || 'Stride Route')}</name>\n`;
  gpx += '    <trkseg>\n';

  for (const coord of coords) {
    const lng = coord[0];
    const lat = coord[1];
    const ele = coord[2];

    gpx += `      <trkpt lat="${lat}" lon="${lng}">`;
    if (ele !== undefined && ele !== null) {
      gpx += `<ele>${ele}</ele>`;
    }
    gpx += '</trkpt>\n';
  }

  gpx += '    </trkseg>\n';
  gpx += '  </trk>\n';

  // Waypoints
  if (waypoints && waypoints.length > 0) {
    for (const wpt of waypoints) {
      gpx += `  <wpt lat="${wpt.lat}" lon="${wpt.lng}">`;
      if (wpt.ele !== undefined && wpt.ele !== null) {
        gpx += `<ele>${wpt.ele}</ele>`;
      }
      if (wpt.name) {
        gpx += `<name>${escapeXml(wpt.name)}</name>`;
      }
      gpx += '</wpt>\n';
    }
  }

  gpx += '</gpx>';

  return gpx;
}
