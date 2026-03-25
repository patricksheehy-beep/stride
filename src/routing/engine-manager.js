/**
 * Routing engine manager with ORS-first fallback chain.
 * Orchestrates routing between ORS and OSRM, with IndexedDB caching
 * and lifecycle events emitted via the central EventBus.
 */
import { eventBus } from '../core/event-bus.js';
import { getCached, setCache } from '../core/cache.js';

const ROUTE_STORE = 'routes';

export class EngineManager {
  /**
   * @param {object} orsAdapter - ORS routing adapter instance
   * @param {object} osrmAdapter - OSRM routing adapter instance
   */
  constructor(orsAdapter, osrmAdapter) {
    this.engines = [
      { name: 'ors', adapter: orsAdapter },
      { name: 'osrm', adapter: osrmAdapter }
    ];
  }

  /**
   * Build a deterministic cache key from waypoints.
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {string} Cache key
   */
  _buildCacheKey(waypoints) {
    return `route:${waypoints.map(p => `${p.lat},${p.lng}`).join(';')}`;
  }

  /**
   * Route between waypoints using the fallback chain.
   * 1. Check cache first
   * 2. Try ORS (primary)
   * 3. Fall back to OSRM on failure
   * 4. Cache successful results
   *
   * Emits events: routing:cache-hit, routing:started, routing:completed,
   * routing:fallback
   *
   * @param {Array<{lat: number, lng: number}>} waypoints
   * @returns {Promise<{route: object, engine: string}>} Routing result
   * @throws {Error} When all routing engines fail
   */
  async route(waypoints) {
    // Check cache first
    const cacheKey = this._buildCacheKey(waypoints);
    const cached = await getCached(ROUTE_STORE, cacheKey);
    if (cached) {
      eventBus.emit('routing:cache-hit', { key: cacheKey });
      return cached;
    }

    eventBus.emit('routing:started', { waypoints });

    let lastError = null;

    for (const engine of this.engines) {
      try {
        const result = await engine.adapter.route(waypoints);
        const routeResult = { route: result, engine: engine.name };
        await setCache(ROUTE_STORE, cacheKey, routeResult);
        eventBus.emit('routing:completed', { engine: engine.name });
        return routeResult;
      } catch (err) {
        lastError = err;
        const fromEngine = engine.name;
        const nextIdx = this.engines.indexOf(engine) + 1;
        if (nextIdx < this.engines.length) {
          eventBus.emit('routing:fallback', {
            from: fromEngine,
            to: this.engines[nextIdx].name,
            reason: err.message
          });
        }
        continue;
      }
    }

    throw new Error('All routing engines failed');
  }
}
