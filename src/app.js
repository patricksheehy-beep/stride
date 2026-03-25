/**
 * Stride application entry point.
 * Wires all core modules and initializes the app.
 */
import 'leaflet/dist/leaflet.css';
import { eventBus } from './core/event-bus.js';
import { store } from './core/state.js';
import { config } from './core/config.js';
import { initMap } from './map/map-manager.js';

function init() {
  console.log('Stride initializing...');
  const map = initMap('map');
  console.log('Stride ready');
  eventBus.emit('app:initialized');
}

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
