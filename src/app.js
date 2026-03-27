/**
 * Stride application entry point.
 * Wires all core modules and initializes the app.
 */
import 'leaflet/dist/leaflet.css';
import { eventBus } from './core/event-bus.js';
import { store } from './core/state.js';
import { config, getApiKey } from './core/config.js';
import { initMap } from './map/map-manager.js';

// Route generation pipeline (Phase 2)
import { RouteGenerator } from './routing/route-generator.js';
import { RouteBuilder } from './routing/route-builder.js';
import { RouteScorer } from './scoring/scorer.js';
import { ORSAdapter } from './routing/adapters/ors.js';
import { OSRMAdapter } from './routing/adapters/osrm.js';
import { EngineManager } from './routing/engine-manager.js';
import { OverpassAdapter } from './data/adapters/overpass.js';

// NL processing pipeline (Phase 3)
import { ClaudeClient } from './nl/claude-client.js';
import { NLParser } from './nl/nl-parser.js';
import { RouteExplainer } from './nl/route-explainer.js';

function init() {
  console.log('Stride initializing...');
  const map = initMap('map');

  // Wire up route generation pipeline
  const orsAdapter = new ORSAdapter(getApiKey('ors'));
  const osrmAdapter = new OSRMAdapter();
  const engineManager = new EngineManager(orsAdapter, osrmAdapter);
  const scorer = new RouteScorer();
  const routeBuilder = new RouteBuilder({ orsAdapter, engineManager, scorer });
  const overpassAdapter = new OverpassAdapter();

  // Wire up NL processing (Phase 3)
  const claudeApiKey = getApiKey('key');
  let nlParser = null;
  let routeExplainer = null;
  if (claudeApiKey) {
    const claudeClient = new ClaudeClient(claudeApiKey);
    nlParser = new NLParser(claudeClient);
    routeExplainer = new RouteExplainer(claudeClient);
  }

  const routeGenerator = new RouteGenerator({
    routeBuilder, scorer, overpassAdapter, nlParser, routeExplainer
  });

  // Listen for route generation requests from UI components
  eventBus.on('route:generate-requested', async ({ startPoint, distanceKm, userDescription }) => {
    try {
      await routeGenerator.generate(startPoint, distanceKm, { userDescription });
    } catch (err) {
      console.error('Route generation failed:', err);
    }
  });

  console.log('Stride ready');
  eventBus.emit('app:initialized');
}

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
