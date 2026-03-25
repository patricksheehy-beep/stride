/**
 * Reactive Proxy-based state store.
 * Property changes automatically emit events via EventBus and notify subscribers.
 */
import { eventBus } from './event-bus.js';

const initialState = {
  userLocation: null,
  selectedMode: 'trail',
  requestedDistance: 5,
  trails: [],
  currentRoute: null,
  isGenerating: false
};

const listeners = new Set();

/**
 * Create a Proxy-wrapped reactive store.
 * On every set: emits 'state:changed' and 'state:{property}' events,
 * and calls all subscriber functions.
 */
function createStore(initial) {
  const state = { ...initial };
  return new Proxy(state, {
    set(target, property, value) {
      const oldValue = target[property];
      target[property] = value;
      if (oldValue !== value) {
        eventBus.emit('state:changed', { property, value, oldValue });
        eventBus.emit(`state:${property}`, { value, oldValue });
        listeners.forEach(fn => fn(property, value));
      }
      return true;
    },
    get(target, property) {
      return target[property];
    }
  });
}

export const store = createStore(initialState);

/**
 * Subscribe to all state changes. Called with (property, value) on each change.
 * @param {Function} fn - Subscriber function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
