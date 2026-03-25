/**
 * IndexedDB wrapper with TTL-based caching using the idb library.
 * Provides get/set/clear operations for multiple object stores.
 */
import { openDB } from 'idb';

const DB_NAME = 'stride-cache';
const DB_VERSION = 1;
export const TRAIL_STORE = 'trails';
export const ROUTE_STORE = 'routes';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

let dbPromise = null;

/**
 * Get a lazy-initialized database connection.
 * Creates object stores on first open.
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TRAIL_STORE)) {
          db.createObjectStore(TRAIL_STORE);
        }
        if (!db.objectStoreNames.contains(ROUTE_STORE)) {
          db.createObjectStore(ROUTE_STORE);
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Retrieve cached data by store name and key.
 * Returns null for missing keys or expired entries (TTL exceeded).
 * Expired entries are automatically deleted.
 *
 * @param {string} storeName - Object store name
 * @param {string} key - Cache key
 * @returns {Promise<*|null>} Cached data or null
 */
export async function getCached(storeName, key) {
  const db = await getDB();
  const entry = await db.get(storeName, key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    // Entry has expired, delete it
    await db.delete(storeName, key);
    return null;
  }

  return entry.data;
}

/**
 * Store data in cache with a TTL.
 *
 * @param {string} storeName - Object store name
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} [ttl=DEFAULT_TTL] - Time-to-live in milliseconds
 */
export async function setCache(storeName, key, data, ttl = DEFAULT_TTL) {
  const db = await getDB();
  await db.put(storeName, { data, timestamp: Date.now(), ttl }, key);
}

/**
 * Clear all entries from a named object store.
 *
 * @param {string} storeName - Object store name to clear
 */
export async function clearCache(storeName) {
  const db = await getDB();
  await db.clear(storeName);
}
