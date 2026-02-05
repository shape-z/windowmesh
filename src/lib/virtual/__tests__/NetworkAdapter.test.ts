import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkAdapter } from '../engine/EngineNetworkAdapter';
import type { VirtualEvent } from '../types/types';

// Mock BroadcastChannel
const mockInstances: any[] = [];
const MockBroadcastChannel = class {
  public name: string;
  public postMessage = vi.fn();
  public close = vi.fn();
  public addEventListener = vi.fn();
  public removeEventListener = vi.fn();
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    mockInstances.push(this);
  }
};

vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

describe('NetworkAdapter', () => {
  let adapter: NetworkAdapter;
  const windowId = 'test-window';

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstances.length = 0; // Clear instances
    adapter = new NetworkAdapter(windowId);
  });


  afterEach(() => {
    adapter.close();
  });

  describe('constructor', () => {
    it('creates BroadcastChannel with default channel', () => {
      expect(mockInstances.length).toBe(1);
      expect(mockInstances[0].name).toBe('vwin:network');
    });

    it('creates BroadcastChannel with custom channel', () => {
      const customAdapter = new NetworkAdapter(windowId, 'custom-channel');
      expect(mockInstances.length).toBe(2);
      expect(mockInstances[1].name).toBe('custom-channel');
      customAdapter.close();
    });
  });

  describe('broadcast()', () => {
    it('posts message to BroadcastChannel', () => {
      const event: VirtualEvent = { type: 'HELLO', payload: { id: 'test', lastSeen: Date.now(), rect: { x: 0, y: 0, w: 100, h: 100 }, timestamp: Date.now() } };
      adapter.broadcast(event);
      expect(mockInstances[0].postMessage).toHaveBeenCalledWith(event);
    });
  });

  describe('onMessage()', () => {
    it('adds listener and returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = adapter.onMessage(handler);

      // Simulate message
      const mockBc = mockInstances[0];
      const event: VirtualEvent = { type: 'HELLO', payload: { id: 'test', lastSeen: Date.now(), rect: { x: 0, y: 0, w: 100, h: 100 }, timestamp: Date.now() } };
      
      if (mockBc.onmessage) mockBc.onmessage({ data: event } as MessageEvent);

      expect(handler).toHaveBeenCalledWith(event);

      // Unsubscribe
      unsubscribe();
      if (mockBc.onmessage) mockBc.onmessage({ data: event } as MessageEvent);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('handles multiple listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      adapter.onMessage(handler1);
      adapter.onMessage(handler2);

      const mockBc = mockInstances[0];
      const event: VirtualEvent = { type: 'HELLO', payload: { id: 'test', lastSeen: Date.now(), rect: { x: 0, y: 0, w: 100, h: 100 }, timestamp: Date.now() } };
      
      if (mockBc.onmessage) mockBc.onmessage({ data: event } as MessageEvent);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('ignores invalid messages', () => {
      const handler = vi.fn();
      adapter.onMessage(handler);

      const mockBc = mockInstances[0];
      if (mockBc.onmessage) {
        mockBc.onmessage({ data: null } as any);
        mockBc.onmessage({ data: {} } as any);
        mockBc.onmessage({ data: { type: '' } } as any);
      }

      expect(handler).not.toHaveBeenCalled();
    });

    it('handles handler errors gracefully', () => {
      const errorHandler = vi.fn(() => { throw new Error('test'); });
      const goodHandler = vi.fn();
      adapter.onMessage(errorHandler);
      adapter.onMessage(goodHandler);

      const mockBc = mockInstances[0];
      const event: VirtualEvent = { type: 'HELLO', payload: { id: 'test', lastSeen: Date.now(), rect: { x: 0, y: 0, w: 100, h: 100 }, timestamp: Date.now() } };
      expect(() => {
        if (mockBc.onmessage) mockBc.onmessage({ data: event } as MessageEvent);
      }).not.toThrow();
      expect(goodHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('close()', () => {
    it('closes BroadcastChannel and clears listeners', () => {
      const handler = vi.fn();
      adapter.onMessage(handler);
      adapter.close();

      expect(mockInstances[0].close).toHaveBeenCalledTimes(1);

      // After close, should not call handlers
      const mockBc = mockInstances[0];
      const event: VirtualEvent = { type: 'HELLO', payload: { id: 'test', lastSeen: Date.now(), rect: { x: 0, y: 0, w: 100, h: 100 }, timestamp: Date.now() } };
      if (mockBc.onmessage) mockBc.onmessage({ data: event } as MessageEvent);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});