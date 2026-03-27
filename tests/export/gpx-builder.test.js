import { describe, it, expect } from 'vitest';
import { buildGPX } from '../../src/export/gpx-builder.js';
import { downloadFile } from '../../src/export/download.js';

describe('buildGPX', () => {
  const make3DFeatureCollection = (coords) => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords
      },
      properties: {}
    }]
  });

  it('produces valid GPX 1.1 XML with trkpt elements containing lat/lon and ele from 3D coordinates', () => {
    const geojson = make3DFeatureCollection([
      [-122.4, 37.7, 10],
      [-122.5, 37.8, 20],
      [-122.6, 37.9, 15]
    ]);
    const gpx = buildGPX(geojson, { name: 'Test Route' });

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('creator="Stride"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx).toContain('<trk>');
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toMatch(/<trkpt lat="37.7" lon="-122.4">/);
    expect(gpx).toMatch(/<ele>10<\/ele>/);
    expect(gpx).toMatch(/<trkpt lat="37.8" lon="-122.5">/);
    expect(gpx).toMatch(/<ele>20<\/ele>/);
    expect(gpx).toMatch(/<trkpt lat="37.9" lon="-122.6">/);
    expect(gpx).toMatch(/<ele>15<\/ele>/);
  });

  it('produces wpt elements from waypoints with name, lat, lon, and ele', () => {
    const geojson = make3DFeatureCollection([[-122.4, 37.7, 10]]);
    const gpx = buildGPX(geojson, {
      name: 'Test Route',
      waypoints: [
        { lat: 37.7, lng: -122.4, ele: 10, name: 'Start' },
        { lat: 37.8, lng: -122.5, ele: 25, name: 'Summit' }
      ]
    });

    expect(gpx).toMatch(/<wpt lat="37.7" lon="-122.4">/);
    expect(gpx).toContain('<name>Start</name>');
    expect(gpx).toMatch(/<wpt lat="37.8" lon="-122.5">/);
    expect(gpx).toContain('<name>Summit</name>');
    expect(gpx).toMatch(/<ele>25<\/ele>/);
  });

  it('escapes XML special characters in route name and waypoint names', () => {
    const geojson = make3DFeatureCollection([[-122.4, 37.7, 10]]);
    const gpx = buildGPX(geojson, {
      name: 'Tom & Jerry\'s <Route> "Special"',
      waypoints: [
        { lat: 37.7, lng: -122.4, name: 'Point A & B <here>' }
      ]
    });

    expect(gpx).toContain('Tom &amp; Jerry&apos;s &lt;Route&gt; &quot;Special&quot;');
    expect(gpx).toContain('Point A &amp; B &lt;here&gt;');
    // Must not contain unescaped ampersands in names
    expect(gpx).not.toMatch(/<name>[^<]*[&][^a][^<]*<\/name>/);
  });

  it('omits ele elements gracefully when given 2D coordinates', () => {
    const geojson = make3DFeatureCollection([
      [-122.4, 37.7],
      [-122.5, 37.8]
    ]);
    const gpx = buildGPX(geojson);

    expect(gpx).toMatch(/<trkpt lat="37.7" lon="-122.4">/);
    expect(gpx).toMatch(/<trkpt lat="37.8" lon="-122.5">/);
    expect(gpx).not.toContain('<ele>');
  });

  it('starts with XML declaration and gpx root element with correct namespace', () => {
    const geojson = make3DFeatureCollection([[-122.4, 37.7, 10]]);
    const gpx = buildGPX(geojson);

    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    expect(gpx).toContain('xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"');
    expect(gpx).toContain('</gpx>');
  });
});

describe('downloadFile', () => {
  it('creates a Blob with correct MIME type and triggers download via anchor click', () => {
    // Track created elements and URLs
    const clicks = [];
    const revokedUrls = [];
    const createdUrls = [];

    // Mock URL.createObjectURL and revokeObjectURL
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
      createdUrls.push(blob);
      return 'blob:mock-url';
    };
    URL.revokeObjectURL = (url) => {
      revokedUrls.push(url);
    };

    // Mock document.createElement to capture anchor
    const originalCreateElement = document.createElement.bind(document);
    let capturedAnchor = null;
    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        capturedAnchor = el;
        el.click = () => clicks.push(true);
      }
      return el;
    };

    try {
      downloadFile('<gpx>test</gpx>', 'route.gpx', 'application/gpx+xml');

      expect(createdUrls.length).toBe(1);
      expect(createdUrls[0]).toBeInstanceOf(Blob);
      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor.href).toContain('blob:mock-url');
      expect(capturedAnchor.download).toBe('route.gpx');
      expect(clicks.length).toBe(1);
      expect(revokedUrls).toContain('blob:mock-url');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = origCreate;
    }
  });
});
