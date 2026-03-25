import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../../src/core/event-bus.js';

// We need a fresh store for each test to avoid cross-test contamination.
// Since the store module exports a singleton, we use dynamic imports with cache busting
// or test against the singleton directly.

describe('State Store', () => {
  let store, subscribe;

  beforeEach(async () => {
    // Dynamic import to get the module
    const mod = await import('../../src/core/state.js');
    store = mod.store;
    subscribe = mod.subscribe;
    // Reset state to initial values
    store.selectedMode = 'trail';
    store.requestedDistance = 5;
    store.userLocation = null;
    store.trails = [];
    store.currentRoute = null;
    store.isGenerating = false;
  });

  it('setting a property emits state:changed with property, value, and oldValue', () => {
    const cb = vi.fn();
    const unsub = eventBus.on('state:changed', cb);
    store.selectedMode = 'sightseeing';
    expect(cb).toHaveBeenCalledWith({
      property: 'selectedMode',
      value: 'sightseeing',
      oldValue: 'trail'
    });
    unsub();
  });

  it('setting a property emits state:{property} with value and oldValue', () => {
    const cb = vi.fn();
    const unsub = eventBus.on('state:selectedMode', cb);
    store.selectedMode = 'streets';
    expect(cb).toHaveBeenCalledWith({
      value: 'streets',
      oldValue: 'trail'
    });
    unsub();
  });

  it('reading a property returns the current value', () => {
    store.selectedMode = 'trail';
    expect(store.selectedMode).toBe('trail');
    store.selectedMode = 'sightseeing';
    expect(store.selectedMode).toBe('sightseeing');
  });

  it('does not emit events when value is unchanged', () => {
    store.selectedMode = 'trail'; // reset
    const cb = vi.fn();
    const unsub = eventBus.on('state:changed', cb);
    store.selectedMode = 'trail'; // same value
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it('subscribe(fn) calls fn on every change and returns unsubscribe', () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    store.requestedDistance = 10;
    expect(cb).toHaveBeenCalledWith('requestedDistance', 10);
    unsub();
    store.requestedDistance = 15;
    expect(cb).toHaveBeenCalledTimes(1); // not called again after unsub
  });
});
