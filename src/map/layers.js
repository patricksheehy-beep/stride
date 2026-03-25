/**
 * Tile layer definitions for the Leaflet map.
 */
export const tileLayers = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }
  }
};
