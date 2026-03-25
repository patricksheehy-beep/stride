/**
 * Leaflet map initialization and management.
 * Uses Leaflet from npm (bundled by Vite).
 */
import L from 'leaflet';
import { eventBus } from '../core/event-bus.js';
import { store } from '../core/state.js';
import { tileLayers } from './layers.js';

let map = null;

/**
 * Initialize the Leaflet map in the given container.
 * Defaults to San Francisco as the initial view.
 *
 * @param {string} containerId - DOM element ID for the map container
 * @returns {L.Map} The Leaflet map instance
 */
export function initMap(containerId = 'map') {
  map = L.map(containerId).setView([37.7749, -122.4194], 13);
  L.tileLayer(tileLayers.osm.url, tileLayers.osm.options).addTo(map);
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
