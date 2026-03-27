/**
 * Route info panel component.
 * Displays route stats (distance, elevation, score), elevation profile chart,
 * route explanation with local context, and GPX export button.
 * Responsive: bottom sheet on mobile, side panel on desktop.
 */
import { eventBus } from '../core/event-bus.js';
import { renderElevationChart, calculateElevationStats, destroyElevationChart } from '../map/elevation-chart.js';
import { buildGPX } from '../export/gpx-builder.js';
import { downloadFile } from '../export/download.js';

export class RoutePanel {
  /**
   * Create a RoutePanel instance.
   * @param {string} containerId - DOM element ID for the panel container
   */
  constructor(containerId) {
    this._container = document.getElementById(containerId);
    if (!this._container) {
      console.warn(`RoutePanel: container #${containerId} not found`);
      return;
    }

    this._chart = null;
    this._currentResult = null;

    this._allRoutes = [];
    this._selectedIndex = 0;
    this._activity = 'run';
    this._isDetailView = false;

    // Build HTML structure
    this._container.innerHTML = `
      <div class="route-panel route-panel--hidden" id="route-panel-inner">
        <div class="route-panel-handle"></div>
        <div class="route-panel-content">
          <div class="route-header" id="rp-header" style="display:none">
            <button class="back-btn" id="rp-back">&larr; All Routes</button>
            <h2 class="route-title" id="rp-title"></h2>
          </div>
          <div class="route-selector" id="rp-route-selector"></div>
          <div class="route-stats">
            <div class="stat">
              <span class="stat-value" id="rp-distance">--</span>
              <span class="stat-label" id="rp-distance-label">mi</span>
            </div>
            <div class="stat">
              <span class="stat-value" id="rp-ascent">--</span>
              <span class="stat-label">ft gain</span>
            </div>
            <div class="stat">
              <span class="stat-value" id="rp-descent">--</span>
              <span class="stat-label">ft loss</span>
            </div>
            <div class="stat">
              <span class="stat-value" id="rp-score">--</span>
              <span class="stat-label">score</span>
            </div>
          </div>
          <div class="elevation-chart-container">
            <canvas id="elevation-chart"></canvas>
          </div>
          <div class="route-explanation" id="rp-explanation"></div>
          <div class="route-segments" id="rp-segments"></div>
          <button class="export-btn" id="rp-export-gpx">Export GPX</button>
        </div>
      </div>
    `;

    // Store element references
    this._panelEl = this._container.querySelector('#route-panel-inner');
    this._headerEl = this._container.querySelector('#rp-header');
    this._backBtn = this._container.querySelector('#rp-back');
    this._titleEl = this._container.querySelector('#rp-title');
    this._selectorEl = this._container.querySelector('#rp-route-selector');
    this._distanceEl = this._container.querySelector('#rp-distance');
    this._ascentEl = this._container.querySelector('#rp-ascent');
    this._descentEl = this._container.querySelector('#rp-descent');
    this._scoreEl = this._container.querySelector('#rp-score');
    this._chartCanvas = this._container.querySelector('#elevation-chart');
    this._explanationEl = this._container.querySelector('#rp-explanation');
    this._segmentsEl = this._container.querySelector('#rp-segments');
    this._exportBtn = this._container.querySelector('#rp-export-gpx');

    // Bind export button
    this._exportBtn.addEventListener('click', () => this._handleExport());

    // Bind back button
    this._backBtn.addEventListener('click', () => this._showListView());

    // Subscribe to route events
    eventBus.on('route:generation-complete', (detail) => this.update(detail));
    eventBus.on('route:generation-started', () => this.showLoading());
    eventBus.on('route:generation-failed', (detail) => this.showError(detail.error));
    eventBus.on('route:activity-changed', (activity) => { this._activity = activity; });
  }

  /**
   * Update the panel with route generation results.
   * @param {object} generateResult - Route generation result with bestRoute
   */
  update(generateResult) {
    if (!this._panelEl) return;

    this._currentResult = generateResult;
    this._allRoutes = generateResult.routes || [];
    this._selectedIndex = 0;
    this._panelEl.classList.remove('route-panel--hidden', 'route-panel--loading');

    if (!this._allRoutes.length) {
      this.showError('No route found');
      return;
    }

    // Build route selector tabs
    this._renderSelector();

    // Display first (best) route
    this._displayRoute(this._allRoutes[0]);
  }

  /**
   * Render route selector tabs for all available routes.
   */
  _activityNoun() {
    const nouns = { run: 'Run', walk: 'Walk', hike: 'Hike', bike: 'Ride' };
    return nouns[this._activity] || 'Route';
  }

  _renderSelector() {
    if (!this._selectorEl) return;
    const noun = this._activityNoun();
    this._selectorEl.innerHTML = this._allRoutes.map((route, i) => {
      const mi = route.distanceKm ? (route.distanceKm * 0.621371).toFixed(1) : '?';
      const score = route.score?.total ? (route.score.total * 100).toFixed(0) : '?';
      const active = i === this._selectedIndex ? 'route-tab--active' : '';
      return `<button class="route-tab ${active}" data-index="${i}">
        <span class="route-tab-label">${noun} ${i + 1}</span>
        <span class="route-tab-detail">${mi} mi · ${score}pts</span>
      </button>`;
    }).join('');

    this._selectorEl.querySelectorAll('.route-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this._selectedIndex = idx;
        this._showDetailView(idx);
        eventBus.emit('route:selection-changed', { route: this._allRoutes[idx], index: idx });
      });
    });
  }

  _showDetailView(idx) {
    this._isDetailView = true;
    const noun = this._activityNoun();
    this._titleEl.textContent = `${noun} ${idx + 1}`;
    this._headerEl.style.display = 'flex';
    this._selectorEl.style.display = 'none';
    this._renderSelector();
    this._displayRoute(this._allRoutes[idx]);
  }

  _showListView() {
    this._isDetailView = false;
    this._headerEl.style.display = 'none';
    this._selectorEl.style.display = 'flex';
    this._renderSelector();
    // Show best route on map
    eventBus.emit('route:selection-changed', { route: this._allRoutes[0], index: 0 });
    this._selectedIndex = 0;
    this._displayRoute(this._allRoutes[0]);
  }

  /**
   * Display a specific route's stats, elevation, and explanation.
   * @param {object} route - Route result object
   */
  _displayRoute(route) {
    const coordinates = route.route?.features?.[0]?.geometry?.coordinates || [];
    const steps = route.route?.features?.[0]?.properties?.segments?.[0]?.steps || [];

    // Distance in miles
    const mi = route.distanceKm ? (route.distanceKm * 0.621371).toFixed(1) : '--';
    this._distanceEl.textContent = mi;

    this._scoreEl.textContent = route.score?.total
      ? (route.score.total * 100).toFixed(0)
      : '--';

    // Elevation in feet
    if (coordinates.length > 0 && coordinates[0]?.length >= 3) {
      const stats = calculateElevationStats(coordinates);
      this._ascentEl.textContent = Math.round(stats.totalAscent * 3.28084);
      this._descentEl.textContent = Math.round(stats.totalDescent * 3.28084);
      destroyElevationChart(this._chart);
      this._chart = renderElevationChart(this._chartCanvas, coordinates);
    } else {
      this._ascentEl.textContent = 'N/A';
      this._descentEl.textContent = 'N/A';
      destroyElevationChart(this._chart);
      this._chart = null;
    }

    // Activity-aware language
    const verb = { run: 'run', hike: 'hike', bike: 'ride' }[this._activity] || 'route';
    let explanation = route.explanation || `No details available for this ${verb}`;

    const trailNames = new Set();
    for (const step of steps) {
      if (step.instruction) {
        const nameMatch = step.instruction.match(/(?:onto|on|along)\s+(.+?)(?:\s+for|\s*$)/i);
        if (nameMatch) {
          trailNames.add(nameMatch[1].trim());
        }
      }
    }
    if (trailNames.size > 0) {
      const namesStr = [...trailNames].slice(0, 3).join(', ');
      explanation = `Along ${namesStr}. ${explanation}`;
    }
    this._explanationEl.textContent = explanation;

    // Build segment breakdown
    this._renderSegments(steps, coordinates);
  }

  /**
   * Render segment-by-segment breakdown with distance and notable points.
   */
  _renderSegments(steps, coordinates) {
    if (!this._segmentsEl || !steps.length) {
      if (this._segmentsEl) this._segmentsEl.innerHTML = '';
      return;
    }

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let cumulativeMi = 0;

    const segments = steps.slice(0, 12).map((step, i) => {
      const segMi = (step.distance || 0) / 1609.34;
      cumulativeMi += segMi;
      const letter = letters[i % 26];

      // Extract road/trail name from instruction
      let name = '';
      if (step.instruction) {
        const nameMatch = step.instruction.match(/(?:onto|on|along)\s+(.+?)(?:\s+for|\s*$)/i);
        name = nameMatch ? nameMatch[1].trim() : '';
      }

      const displayName = name || step.instruction || `Segment ${letter}`;
      const segLabel = segMi >= 0.1 ? `${segMi.toFixed(1)} mi` : `${Math.round(segMi * 5280)} ft`;

      return `<div class="segment">
        <span class="segment-letter">${letter}</span>
        <div class="segment-info">
          <span class="segment-name">${displayName}</span>
          <span class="segment-dist">${segLabel} · ${cumulativeMi.toFixed(1)} mi total</span>
        </div>
      </div>`;
    });

    this._segmentsEl.innerHTML = `<div class="segments-title">Segments</div>${segments.join('')}`;
  }

  /**
   * Handle GPX export button click.
   * Builds GPX from current route and triggers download.
   */
  _handleExport() {
    const selectedRoute = this._allRoutes[this._selectedIndex];
    if (!selectedRoute) return;

    const routeGeoJSON = selectedRoute.route;
    const steps = routeGeoJSON?.features?.[0]?.properties?.segments?.[0]?.steps || [];
    const coordinates = routeGeoJSON?.features?.[0]?.geometry?.coordinates || [];

    // Build waypoints from ORS steps
    const waypoints = steps.map(step => {
      const coordIndex = step.way_points?.[0] ?? 0;
      const coord = coordinates[coordIndex] || coordinates[0];
      return {
        lat: coord[1],
        lng: coord[0],
        ele: coord[2],
        name: step.instruction || ''
      };
    });

    const noun = this._activityNoun();
    const mi = selectedRoute.distanceKm ? (selectedRoute.distanceKm * 0.621371).toFixed(1) : '';
    const gpxString = buildGPX(routeGeoJSON, {
      name: `Stride ${noun} ${this._selectedIndex + 1} - ${mi} mi`,
      waypoints
    });

    const timestamp = Date.now();
    downloadFile(gpxString, `stride-route-${timestamp}.gpx`);
  }

  /**
   * Show loading state while route generates.
   */
  showLoading() {
    if (!this._panelEl) return;
    this._panelEl.classList.remove('route-panel--hidden');
    this._panelEl.classList.add('route-panel--loading');
    this._distanceEl.textContent = '--';
    this._ascentEl.textContent = '--';
    this._descentEl.textContent = '--';
    this._scoreEl.textContent = '--';
    this._explanationEl.textContent = 'Generating route...';
    destroyElevationChart(this._chart);
    this._chart = null;
  }

  /**
   * Show error state.
   * @param {string} message - Error message to display
   */
  showError(message) {
    if (!this._panelEl) return;
    this._panelEl.classList.remove('route-panel--hidden', 'route-panel--loading');
    this._explanationEl.textContent = message || 'An error occurred';
  }

  /**
   * Hide the panel.
   */
  hide() {
    if (!this._panelEl) return;
    this._panelEl.classList.add('route-panel--hidden');
  }
}
