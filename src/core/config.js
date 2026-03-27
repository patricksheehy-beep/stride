/**
 * API key management and application constants.
 * Keys are stored in localStorage, keyed by service name.
 */

/**
 * Retrieve an API key for a service from localStorage.
 * @param {string} service - Service identifier (e.g., 'ors')
 * @returns {string|null} The API key or null if not set
 */
// Map service names to the localStorage keys used by the original prototype
const KEY_MAP = {
  ors: 'stride_ors_key',
  key: 'stride_api_key',
  claude: 'stride_api_key'
};

export function getApiKey(service) {
  const storageKey = KEY_MAP[service] || `stride_api_${service}`;
  const key = localStorage.getItem(storageKey);
  return key || null;
}

/**
 * Store an API key for a service in localStorage.
 * @param {string} service - Service identifier (e.g., 'ors')
 * @param {string} key - The API key value
 */
export function setApiKey(service, key) {
  const storageKey = KEY_MAP[service] || `stride_api_${service}`;
  localStorage.setItem(storageKey, key);
}

/**
 * Application configuration constants.
 */
export const config = {
  overpassEndpoint: 'https://overpass-api.de/api/interpreter',
  overpassFallbackEndpoint: 'https://overpass.kumi.systems/api/interpreter',
  orsBaseUrl: 'https://api.openrouteservice.org',
  osrmBaseUrl: 'https://router.project-osrm.org',
  overpassTimeout: 300,
  cacheTTL: 24 * 60 * 60 * 1000,
  nominatimEndpoint: 'https://nominatim.openstreetmap.org'
};
