/**
 * Stride application entry point.
 * Wires all core modules and initializes the app.
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { eventBus } from './core/event-bus.js';
import { store } from './core/state.js';
import { config, getApiKey, setApiKey } from './core/config.js';
import { initMap, getMap } from './map/map-manager.js';

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

// Route display pipeline (Phase 4)
import { RoutePanel } from './ui/route-panel.js';
import { renderRoute, clearRoute, addDistanceMarkers, addTurnMarkers, extractTurnPoints } from './map/route-renderer.js';

function init() {
  console.log('Stride initializing...');
  const map = initMap('map');

  // Initialize route info panel
  const routePanel = new RoutePanel('route-panel-container');

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
  eventBus.on('route:generate-requested', async ({ startPoint, distanceKm, userDescription, routeType, activity, destination }) => {
    try {
      await routeGenerator.generate(startPoint, distanceKm, { userDescription, routeType, activity, destination });
    } catch (err) {
      console.error('Route generation failed:', err);
    }
  });

  // Render route on map when generation completes
  eventBus.on('route:generation-complete', ({ bestRoute }) => {
    const mapInstance = getMap();
    if (!mapInstance || !bestRoute?.route) return;

    // Clear previous route and render new one
    clearRoute(mapInstance);
    renderRoute(mapInstance, bestRoute.route);

    // Add turn-by-turn markers from ORS instructions
    const turnPoints = extractTurnPoints(bestRoute.route);
    if (turnPoints.length > 0) {
      addTurnMarkers(mapInstance, turnPoints);
    }

    // Add distance markers at 1km intervals
    const routeFeature = bestRoute.route.features?.[0];
    if (routeFeature) {
      addDistanceMarkers(mapInstance, routeFeature, 1);
    }
  });

  // Re-render when user selects a different route option
  eventBus.on('route:selection-changed', ({ route }) => {
    const mapInstance = getMap();
    if (!mapInstance || !route?.route) return;

    clearRoute(mapInstance);
    renderRoute(mapInstance, route.route);

    const turnPoints = extractTurnPoints(route.route);
    if (turnPoints.length > 0) {
      addTurnMarkers(mapInstance, turnPoints);
    }

    const routeFeature = route.route.features?.[0];
    if (routeFeature) {
      addDistanceMarkers(mapInstance, routeFeature, 1);
    }
  });

  // Clear route from map when new generation starts
  eventBus.on('route:generation-started', () => {
    const mapInstance = getMap();
    if (mapInstance) {
      clearRoute(mapInstance);
    }
  });

  // ---- UI Controls ----
  let selectedRouteType = 'loop';
  let selectedActivity = 'run';
  let selectedVibe = 'general';
  let startPoint = null;
  let destinationPoint = null;
  let startMarker = null;
  let destMarker = null;

  const descriptionInput = document.getElementById('description-input');

  // Vibe presets — pre-fill the description based on vibe + activity
  const VIBE_PRESETS = {
    general: { run: '', walk: '', hike: '', bike: '' },
    nature: {
      run: 'tree-lined trails, parks, green spaces, away from traffic',
      walk: 'peaceful parks, gardens, tree-lined paths, nature',
      hike: 'forest trails, elevation, scenic overlooks, wilderness',
      bike: 'greenway paths, park trails, tree cover, nature'
    },
    sightseeing: {
      run: 'landmarks, waterfront, interesting neighborhoods, scenic views',
      walk: 'historic areas, landmarks, waterfront promenades, scenic spots',
      hike: 'scenic vistas, viewpoints, ridgeline trails, panoramic views',
      bike: 'waterfront, scenic routes, landmarks, interesting streets'
    }
  };

  function _updateVibeDescription() {
    const preset = VIBE_PRESETS[selectedVibe]?.[selectedActivity] || '';
    if (descriptionInput) descriptionInput.placeholder = preset || 'waterfront, shady, flat...';
    // Only auto-fill if user hasn't typed custom text
    if (descriptionInput && !descriptionInput.dataset.userEdited) {
      descriptionInput.value = preset;
    }
  }

  // Track if user manually edited the description
  if (descriptionInput) {
    descriptionInput.addEventListener('input', () => {
      descriptionInput.dataset.userEdited = 'true';
    });
  }

  // Route type selector
  const typeSelector = document.getElementById('route-type-selector');
  const destGroup = document.getElementById('destination-group');
  const destHint = document.getElementById('destination-hint');

  if (typeSelector) {
    typeSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      typeSelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('type-btn--active'));
      btn.classList.add('type-btn--active');
      selectedRouteType = btn.dataset.type;
      destGroup.style.display = selectedRouteType === 'point-to-point' ? 'block' : 'none';
    });
  }

  // Activity type selector (run/walk/hike/bike)
  const activitySelector = document.getElementById('activity-type-selector');
  if (activitySelector) {
    activitySelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      activitySelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('type-btn--active'));
      btn.classList.add('type-btn--active');
      selectedActivity = btn.dataset.activity;
      eventBus.emit('route:activity-changed', selectedActivity);
      descriptionInput.dataset.userEdited = '';
      _updateVibeDescription();
    });
  }

  // Vibe selector (general/nature/sightseeing)
  const vibeSelector = document.getElementById('vibe-selector');
  if (vibeSelector) {
    vibeSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      vibeSelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('type-btn--active'));
      btn.classList.add('type-btn--active');
      selectedVibe = btn.dataset.vibe;
      descriptionInput.dataset.userEdited = '';
      _updateVibeDescription();
    });
  }

  // API key settings
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const orsKeyInput = document.getElementById('ors-key-input');
  const claudeKeyInput = document.getElementById('claude-key-input');
  const saveKeysBtn = document.getElementById('save-keys-btn');

  if (settingsToggle) {
    settingsToggle.addEventListener('click', () => {
      const visible = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = visible ? 'none' : 'block';
      // Pre-fill with existing keys (masked)
      if (!visible) {
        const orsKey = getApiKey('ors');
        const claudeKey = getApiKey('claude');
        if (orsKey) orsKeyInput.value = orsKey;
        if (claudeKey) claudeKeyInput.value = claudeKey;
      }
    });
  }

  if (saveKeysBtn) {
    saveKeysBtn.addEventListener('click', () => {
      if (orsKeyInput.value.trim()) {
        setApiKey('ors', orsKeyInput.value.trim());
      }
      if (claudeKeyInput.value.trim()) {
        setApiKey('claude', claudeKeyInput.value.trim());
      }
      settingsPanel.style.display = 'none';
      // Reload to pick up new keys
      window.location.reload();
    });
  }

  // Map click — set start point (first click) or destination (point-to-point second click)
  const mapInstance = getMap();
  if (mapInstance) {
    mapInstance.on('click', (e) => {
      const { lat, lng } = e.latlng;

      if (selectedRouteType === 'point-to-point' && startPoint && !destinationPoint) {
        // Second click: set destination
        destinationPoint = { lat, lng };
        if (destMarker) mapInstance.removeLayer(destMarker);
        destMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: 'dest-marker', html: '<div class="marker-pin marker-pin--dest">B</div>', iconSize: [30, 30], iconAnchor: [15, 30] })
        }).addTo(mapInstance);
        destHint.textContent = `Destination: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } else {
        // First click (or non-P2P): set start
        startPoint = { lat, lng };
        destinationPoint = null;
        if (startMarker) mapInstance.removeLayer(startMarker);
        if (destMarker) { mapInstance.removeLayer(destMarker); destMarker = null; }
        startMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: 'start-marker', html: '<div class="marker-pin marker-pin--start">A</div>', iconSize: [30, 30], iconAnchor: [15, 30] })
        }).addTo(mapInstance);
        if (selectedRouteType === 'point-to-point') {
          destHint.textContent = 'Now tap the map to set your destination';
        }
      }
    });
  }

  // Generate button
  const generateBtn = document.getElementById('generate-btn');
  const distanceInput = document.getElementById('distance-input');

  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      if (!startPoint) {
        // Try geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              _emitGenerate();
            },
            () => alert('Tap the map to set your starting point')
          );
          return;
        }
        alert('Tap the map to set your starting point');
        return;
      }
      _emitGenerate();
    });
  }

  function _emitGenerate() {
    const distanceMi = parseFloat(distanceInput?.value) || 3;
    const distanceKm = distanceMi * 1.60934;
    const userDescription = descriptionInput?.value || '';
    eventBus.emit('route:generate-requested', {
      startPoint,
      distanceKm,
      userDescription: userDescription || undefined,
      routeType: selectedRouteType,
      activity: selectedActivity,
      destination: selectedRouteType === 'point-to-point' ? destinationPoint : undefined
    });
  }

  // Try auto-locating on load
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const mapInst = getMap();
        if (mapInst) mapInst.setView([startPoint.lat, startPoint.lng], 14);
      },
      () => {} // User denied — they'll tap the map
    );
  }

  console.log('Stride ready');
  eventBus.emit('app:initialized');
}

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
