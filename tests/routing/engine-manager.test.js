import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineManager } from '../../src/routing/engine-manager.js';
import { eventBus } from '../../src/core/event-bus.js';
import { getCached, setCache, clearCache, ROUTE_STORE } from '../../src/core/cache.js';

describe('EngineManager', () => {
  let mockOrs;
  let mockOsrm;
  let manager;
  const waypoints = [
    { lat: 37.7, lng: -122.4 },
    { lat: 37.8, lng: -122.5 }
  ];
  const orsResult = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.5, 37.8]] },
      properties: { distance: 5, engine: 'ors' }
    }]
  };
  const osrmResult = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.5, 37.8]] },
      properties: { distance: 5, engine: 'osrm' }
    }]
  };

  beforeEach(async () => {
    mockOrs = { route: vi.fn() };
    mockOsrm = { route: vi.fn() };
    manager = new EngineManager(mockOrs, mockOsrm);
    // Clear the routes cache before each test
    await clearCache(ROUTE_STORE);
  });

  it('stores both adapters in engines array in order', () => {
    expect(manager.engines).toHaveLength(2);
    expect(manager.engines[0].name).toBe('ors');
    expect(manager.engines[0].adapter).toBe(mockOrs);
    expect(manager.engines[1].name).toBe('osrm');
    expect(manager.engines[1].adapter).toBe(mockOsrm);
  });

  it('returns ORS result when ORS succeeds', async () => {
    mockOrs.route.mockResolvedValue(orsResult);

    const result = await manager.route(waypoints);

    expect(result.route).toBe(orsResult);
    expect(result.engine).toBe('ors');
    expect(mockOrs.route).toHaveBeenCalledWith(waypoints);
    expect(mockOsrm.route).not.toHaveBeenCalled();
  });

  it('falls back to OSRM when ORS fails', async () => {
    mockOrs.route.mockRejectedValue(new Error('ORS rate limit exceeded'));
    mockOsrm.route.mockResolvedValue(osrmResult);

    const result = await manager.route(waypoints);

    expect(result.route).toBe(osrmResult);
    expect(result.engine).toBe('osrm');
    expect(mockOrs.route).toHaveBeenCalledWith(waypoints);
    expect(mockOsrm.route).toHaveBeenCalledWith(waypoints);
  });

  it('throws when all engines fail', async () => {
    mockOrs.route.mockRejectedValue(new Error('ORS down'));
    mockOsrm.route.mockRejectedValue(new Error('OSRM down'));

    await expect(manager.route(waypoints)).rejects.toThrow('All routing engines failed');
  });

  it('emits routing:started event before routing', async () => {
    mockOrs.route.mockResolvedValue(orsResult);
    const emitSpy = vi.spyOn(eventBus, 'emit');

    await manager.route(waypoints);

    expect(emitSpy).toHaveBeenCalledWith('routing:started', { waypoints });
    emitSpy.mockRestore();
  });

  it('emits routing:completed event on success', async () => {
    mockOrs.route.mockResolvedValue(orsResult);
    const emitSpy = vi.spyOn(eventBus, 'emit');

    await manager.route(waypoints);

    expect(emitSpy).toHaveBeenCalledWith('routing:completed', { engine: 'ors' });
    emitSpy.mockRestore();
  });

  it('emits routing:fallback event when ORS fails and OSRM is tried', async () => {
    mockOrs.route.mockRejectedValue(new Error('ORS rate limit exceeded'));
    mockOsrm.route.mockResolvedValue(osrmResult);
    const emitSpy = vi.spyOn(eventBus, 'emit');

    await manager.route(waypoints);

    expect(emitSpy).toHaveBeenCalledWith('routing:fallback', {
      from: 'ors',
      to: 'osrm',
      reason: 'ORS rate limit exceeded'
    });
    emitSpy.mockRestore();
  });

  it('caches successful routing results', async () => {
    mockOrs.route.mockResolvedValue(orsResult);

    await manager.route(waypoints);

    // Verify cache was populated
    const cacheKey = manager._buildCacheKey(waypoints);
    const cached = await getCached(ROUTE_STORE, cacheKey);
    expect(cached).toBeTruthy();
    expect(cached.engine).toBe('ors');
    expect(cached.route).toBe(orsResult);
  });

  it('returns cached result without calling adapters', async () => {
    // Pre-populate the cache
    const cacheKey = manager._buildCacheKey(waypoints);
    const cachedResult = { route: orsResult, engine: 'ors' };
    await setCache(ROUTE_STORE, cacheKey, cachedResult);

    const result = await manager.route(waypoints);

    expect(result).toEqual(cachedResult);
    expect(mockOrs.route).not.toHaveBeenCalled();
    expect(mockOsrm.route).not.toHaveBeenCalled();
  });

  it('emits routing:cache-hit when returning cached result', async () => {
    const cacheKey = manager._buildCacheKey(waypoints);
    await setCache(ROUTE_STORE, cacheKey, { route: orsResult, engine: 'ors' });
    const emitSpy = vi.spyOn(eventBus, 'emit');

    await manager.route(waypoints);

    expect(emitSpy).toHaveBeenCalledWith('routing:cache-hit', { key: cacheKey });
    emitSpy.mockRestore();
  });

  describe('_buildCacheKey', () => {
    it('generates a deterministic key from waypoints', () => {
      const key = manager._buildCacheKey(waypoints);
      expect(key).toBe('route:37.7,-122.4;37.8,-122.5');
    });

    it('produces different keys for different waypoints', () => {
      const key1 = manager._buildCacheKey(waypoints);
      const key2 = manager._buildCacheKey([{ lat: 0, lng: 0 }]);
      expect(key1).not.toBe(key2);
    });
  });
});
