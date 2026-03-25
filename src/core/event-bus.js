/**
 * Central pub/sub EventBus built on the browser's native EventTarget API.
 * Modules communicate through events without direct cross-imports.
 */
class EventBus extends EventTarget {
  /**
   * Emit an event with optional detail payload.
   * @param {string} type - Event name
   * @param {*} detail - Event payload
   */
  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string} type - Event name
   * @param {Function} callback - Called with event detail
   * @returns {Function} Unsubscribe function
   */
  on(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }

  /**
   * Subscribe to an event once. Automatically removed after first call.
   * @param {string} type - Event name
   * @param {Function} callback - Called with event detail
   */
  once(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler, { once: true });
  }
}

export const eventBus = new EventBus();
