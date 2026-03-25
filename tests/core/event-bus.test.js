import { describe, it, expect, vi } from 'vitest';
import { eventBus } from '../../src/core/event-bus.js';

describe('EventBus', () => {
  it('on() registers a listener and emit() calls it with detail', () => {
    const cb = vi.fn();
    eventBus.on('test-emit', cb);
    eventBus.emit('test-emit', { x: 1 });
    expect(cb).toHaveBeenCalledWith({ x: 1 });
  });

  it('on() returns an unsubscribe function that removes the listener', () => {
    const cb = vi.fn();
    const unsub = eventBus.on('test-unsub', cb);
    unsub();
    eventBus.emit('test-unsub', { x: 2 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('once() fires callback exactly once then auto-removes', () => {
    const cb = vi.fn();
    eventBus.once('test-once', cb);
    eventBus.emit('test-once', { x: 3 });
    eventBus.emit('test-once', { x: 4 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ x: 3 });
  });

  it('emit() with no detail passes empty object', () => {
    const cb = vi.fn();
    eventBus.on('test-no-detail', cb);
    eventBus.emit('test-no-detail');
    expect(cb).toHaveBeenCalledWith({});
  });

  it('multiple listeners receive the same event', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    eventBus.on('test-multi', cb1);
    eventBus.on('test-multi', cb2);
    eventBus.emit('test-multi', { value: 'hello' });
    expect(cb1).toHaveBeenCalledWith({ value: 'hello' });
    expect(cb2).toHaveBeenCalledWith({ value: 'hello' });
  });
});
