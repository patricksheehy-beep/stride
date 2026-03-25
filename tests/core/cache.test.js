import { describe, it, expect, beforeEach } from 'vitest';
import { getCached, setCache, clearCache, TRAIL_STORE } from '../../src/core/cache.js';

describe('Cache (IndexedDB)', () => {
  beforeEach(async () => {
    // Clear the test store before each test
    await clearCache(TRAIL_STORE);
  });

  it('setCache stores data and getCached retrieves it', async () => {
    await setCache(TRAIL_STORE, 'key1', { data: 'test' });
    const result = await getCached(TRAIL_STORE, 'key1');
    expect(result).toEqual({ data: 'test' });
  });

  it('getCached returns null for non-existent keys', async () => {
    const result = await getCached(TRAIL_STORE, 'nonexistent');
    expect(result).toBeNull();
  });

  it('getCached returns null for expired entries (TTL exceeded)', async () => {
    // Store with a very short TTL (1ms)
    await setCache(TRAIL_STORE, 'expiring', { data: 'old' }, 1);
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    const result = await getCached(TRAIL_STORE, 'expiring');
    expect(result).toBeNull();
  });

  it('clearCache removes all entries from the store', async () => {
    await setCache(TRAIL_STORE, 'a', { data: 1 });
    await setCache(TRAIL_STORE, 'b', { data: 2 });
    await clearCache(TRAIL_STORE);
    const resultA = await getCached(TRAIL_STORE, 'a');
    const resultB = await getCached(TRAIL_STORE, 'b');
    expect(resultA).toBeNull();
    expect(resultB).toBeNull();
  });

  it('setCache overwrites existing entries', async () => {
    await setCache(TRAIL_STORE, 'key1', { data: 'first' });
    await setCache(TRAIL_STORE, 'key1', { data: 'second' });
    const result = await getCached(TRAIL_STORE, 'key1');
    expect(result).toEqual({ data: 'second' });
  });
});
