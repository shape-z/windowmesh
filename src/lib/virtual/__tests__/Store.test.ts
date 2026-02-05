import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store } from '../engine/EngineStore';

describe('Store', () => {
  let store: Store<{ count: number; name: string }>;

  beforeEach(() => {
    store = new Store({ count: 0, name: 'test' });
  });

  describe('get()', () => {
    it('returns the current state', () => {
      expect(store.get()).toEqual({ count: 0, name: 'test' });
    });
  });

  describe('set()', () => {
    it('updates state with partial object', () => {
      store.set({ count: 5 });
      expect(store.get()).toEqual({ count: 5, name: 'test' });
    });

    it('updates state with function', () => {
      store.set((prev) => ({ count: prev.count + 1 }));
      expect(store.get()).toEqual({ count: 1, name: 'test' });
    });

    it('emits to listeners on change', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.set({ count: 10 });
      expect(listener).toHaveBeenCalledWith({ count: 10, name: 'test' });
    });

    it('handles empty partial object', () => {
      store.set({});
      expect(store.get()).toEqual({ count: 0, name: 'test' });
    });

    it('handles function that returns empty object', () => {
      store.set(() => ({}));
      expect(store.get()).toEqual({ count: 0, name: 'test' });
    });
  });

  describe('update()', () => {
    it('updates state via updater function', () => {
      store.update((draft) => {
        draft.count = 42;
        draft.name = 'updated';
      });
      expect(store.get()).toEqual({ count: 42, name: 'updated' });
    });

    it('emits to listeners on update', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.update((draft) => {
        draft.count = 1;
      });
      expect(listener).toHaveBeenCalledWith({ count: 1, name: 'test' });
    });
  });

  describe('subscribe()', () => {
    it('adds listener and returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      store.set({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      store.set({ count: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // No additional call
    });

    it('handles multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store.subscribe(listener1);
      store.subscribe(listener2);
      store.set({ count: 1 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn(() => { throw new Error('test error'); });
      const goodListener = vi.fn();
      store.subscribe(errorListener);
      store.subscribe(goodListener);
      // Store catches errors, so expect no error
      expect(() => store.set({ count: 1 })).not.toThrow();
      // And good listener is still called
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('update()', () => {
    it('updates state via callback function', () => {
      store.update((s) => {
        s.count += 1;
      });
      expect(store.get().count).toBe(1);
    });
  });
});