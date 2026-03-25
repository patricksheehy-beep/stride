/**
 * API key management and application constants.
 * Keys are stored in localStorage, keyed by service name.
 */

/**
 * Retrieve an API key for a service from localStorage.
 * @param {string} service - Service identifier (e.g., 'ors')
 * @returns {string|null} The API key or null if not set
 */
export function getApiKey(service) {
  const key = localStorage.getItem(`stride_api_${service}`);
  return key || null;
}

/**
 * Store an API key for a service in localStorage.
 * @param {string} service - Service identifier (e.g., 'ors')
 * @param {string} key - The API key value
 */
export function setApiKey(service, key) {
  localStorage.setItem(`stride_api_${service}`, key);
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
