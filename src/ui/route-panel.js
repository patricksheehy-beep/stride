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

    // Build HTML structure
    this._container.innerHTML = `
      <div class="route-panel route-panel--hidden" id="route-panel-inner">
        <div class="route-panel-handle"></div>
        <div class="route-panel-content">
          <div class="route-stats">
            <div class="stat">
              <span class="stat-value" id="rp-distance">--</span>
              <span class="stat-label">km</span>
            </div>
            <div class="stat">
              <span class="stat-value" id="rp-ascent">--</span>
              <span class="stat-label">m gain</span>
            </div>
            <div class="stat">
              <span class="stat-value" id="rp-descent">--</span>
              <span class="stat-label">m loss</span>
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
          <button class="export-btn" id="rp-export-gpx">Export GPX</button>
        </div>
      </div>
    `;

    // Store element references
    this._panelEl = this._container.querySelector('#route-panel-inner');
    this._distanceEl = this._container.querySelector('#rp-distance');
    this._ascentEl = this._container.querySelector('#rp-ascent');
    this._descentEl = this._container.querySelector('#rp-descent');
    this._scoreEl = this._container.querySelector('#rp-score');
    this._chartCanvas = this._container.querySelector('#elevation-chart');
    this._explanationEl = this._container.querySelector('#rp-explanation');
    this._exportBtn = this._container.querySelector('#rp-export-gpx');

    // Bind export button
    this._exportBtn.addEventListener('click', () => this._handleExport());

    // Subscribe to route events
    eventBus.on('route:generation-complete', (detail) => this.update(detail));
    eventBus.on('route:generation-started', () => this.showLoading());
    eventBus.on('route:generation-failed', (detail) => this.showError(detail.error));
  }

  /**
   * Update the panel with route generation results.
   * @param {object} generateResult - Route generation result with bestRoute
   */
  update(generateResult) {
    if (!this._panelEl) return;

    this._currentResult = generateResult;
    this._panelEl.classList.remove('route-panel--hidden', 'route-panel--loading');

    const bestRoute = generateResult.bestRoute;
    if (!bestRoute) {
      this.showError('No route found');
      return;
    }

    const coordinates = bestRoute.route?.features?.[0]?.geometry?.coordinates || [];
    const steps = bestRoute.route?.features?.[0]?.properties?.segments?.[0]?.steps || [];

    // Update distance
    this._distanceEl.textContent = bestRoute.distanceKm?.toFixed(1) || '--';

    // Update score
    this._scoreEl.textContent = bestRoute.score?.total
      ? (bestRoute.score.total * 100).toFixed(0)
      : '--';

    // Calculate and display elevation stats (only if 3D coordinates)
    if (coordinates.length > 0 && coordinates[0]?.length >= 3) {
      const stats = calculateElevationStats(coordinates);
      this._ascentEl.textContent = Math.round(stats.totalAscent);
      this._descentEl.textContent = Math.round(stats.totalDescent);

      // Render elevation chart
      destroyElevationChart(this._chart);
      this._chart = renderElevationChart(this._chartCanvas, coordinates);
    } else {
      this._ascentEl.textContent = 'N/A';
      this._descentEl.textContent = 'N/A';
      destroyElevationChart(this._chart);
      this._chart = null;
    }

    // Build explanation with local context from ORS steps (EXPORT-04)
    let explanation = bestRoute.explanation || 'No explanation available';

    // Extract unique street/trail names from ORS instruction steps
    const trailNames = new Set();
    for (const step of steps) {
      if (step.instruction) {
        // ORS instructions often contain street/trail names after action verbs
        // e.g., "Turn left onto Bay Trail" or "Continue on Stevens Creek Trail"
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
  }

  /**
   * Handle GPX export button click.
   * Builds GPX from current route and triggers download.
   */
  _handleExport() {
    if (!this._currentResult?.bestRoute) return;

    const bestRoute = this._currentResult.bestRoute;
    const routeGeoJSON = bestRoute.route;
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

    const gpxString = buildGPX(routeGeoJSON, {
      name: `Stride Route - ${bestRoute.distanceKm?.toFixed(1) || ''}km`,
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
