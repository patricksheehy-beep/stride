/**
 * Leaflet map initialization and management.
 * Uses Leaflet from npm (bundled by Vite).
 * Default tile layer is CartoDB Dark Matter for Stride's dark theme.
 */
import L from 'leaflet';
import { eventBus } from '../core/event-bus.js';
import { store } from '../core/state.js';
import { tileLayers } from './layers.js';

let map = null;

/**
 * Initialize the Leaflet map in the given container.
 * Defaults to San Francisco as the initial view.
 * Uses CartoDB Dark Matter tiles as default with OSM as switchable alternative.
 *
 * @param {string} containerId - DOM element ID for the map container
 * @returns {L.Map} The Leaflet map instance
 */
export function initMap(containerId = 'map') {
  map = L.map(containerId).setView([37.7749, -122.4194], 13);

  // Remove Leaflet attribution prefix for cleaner mobile display
  map.attributionControl.setPrefix('');

  // Dark tiles as default
  const darkLayer = L.tileLayer(tileLayers.dark.url, tileLayers.dark.options).addTo(map);
  const osmLayer = L.tileLayer(tileLayers.osm.url, tileLayers.osm.options);

  // Layer control for switching between dark and OSM tiles
  L.control.layers({
    'Dark': darkLayer,
    'OpenStreetMap': osmLayer
  }, null, { position: 'topright' }).addTo(map);

  eventBus.emit('map:initialized', { map });
  return map;
}

/**
 * Get the current map instance.
 * @returns {L.Map|null}
 */
export function getMap() {
  return map;
}
