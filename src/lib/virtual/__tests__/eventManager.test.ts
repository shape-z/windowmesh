import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventManager } from '../extensions/eventManager';
import type { VirtualEngine } from '../engine/VirtualEngine';

describe('EventManager', () => {
  let eventManager: EventManager;
  let mockEngine: VirtualEngine;

  beforeEach(() => {
    mockEngine = {
      setSharedData: vi.fn()
    } as any;
    eventManager = new EventManager(mockEngine);
  });

  describe('addEventListener()', () => {
    it('adds listener for event type', () => {
      const listener = vi.fn();
      eventManager.addEventListener('test', listener);
      eventManager.dispatchEvent('test', 'value');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test', data: 'value' })
      );
    });
  });

  describe('removeEventListener()', () => {
    it('removes listener', () => {
      const listener = vi.fn();
      eventManager.addEventListener('test', listener);
      eventManager.removeEventListener('test', listener);
      eventManager.dispatchEvent('test');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('dispatchEvent()', () => {
    it('dispatches to listeners and broadcasts via engine', () => {
      const listener = vi.fn();
      eventManager.addEventListener('test', listener);
      eventManager.dispatchEvent('test', 'payload');

      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'event_test',
        expect.objectContaining({ type: 'test', data: 'payload' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test', data: 'payload' })
      );
    });
  });

  describe('destroy()', () => {
    it('clears listeners', () => {
      const listener = vi.fn();
      eventManager.addEventListener('test', listener);
      eventManager.destroy();
      eventManager.dispatchEvent('test');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});