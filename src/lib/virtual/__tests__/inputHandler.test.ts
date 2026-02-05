import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualInputs } from '../extensions/inputHandler';
import type { VirtualEngine } from '../engine/VirtualEngine';

// Mock VirtualCtx
const mockCtx = {
  windowId: 'test-window',
  viewportOffset: { x: 0, y: 0 }
};

// Mock document methods
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

// Spy on document methods instead of replacing the global object
vi.spyOn(document, 'addEventListener').mockImplementation(mockAddEventListener);
vi.spyOn(document, 'removeEventListener').mockImplementation(mockRemoveEventListener);

vi.mock('../extensions/virtualContext', () => ({
  VirtualCtx: {
    // Mock context
  }
}));

// Mock React useContext
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: vi.fn(() => mockCtx),
    useEffect: actual.useEffect,
    useState: actual.useState
  };
});

describe('useVirtualInputs', () => {
  let mockEngine: VirtualEngine;

  beforeEach(() => {
    mockEngine = {
      setSharedData: vi.fn(),
      store: {
        subscribe: vi.fn((listener) => {
          // Store the listener for testing
          (mockEngine.store as any)._listener = listener;
          return vi.fn(); // unsubscribe function
        }),
        get: vi.fn(() => ({
          windowId: 'test',
          winRect: { x: 0, y: 0, w: 800, h: 600 },
          windows: {},
          layout: null,
          isLeader: false,
          permissionGranted: false,
          viewportOffset: { x: 0, y: 0 },
          sharedData: {}
        }))
      }
    } as any;
  });

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useVirtualInputs(mockEngine));
    expect(result.current).toEqual([]);
  });

  it('broadcasts input events via engine', () => {
    // Mock addEventListener to simulate events
    const mockAddEventListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: mockAddEventListener,
      removeEventListener: vi.fn()
    });

    renderHook(() => useVirtualInputs(mockEngine));

    // Simulate keydown
    const keydownHandler = mockAddEventListener.mock.calls.find(call => call[0] === 'keydown')?.[1];
    keydownHandler({ key: 'a' });

    expect(mockEngine.setSharedData).toHaveBeenCalledWith(
      'input_event',
      expect.objectContaining({ type: 'keydown', key: 'a' })
    );
  });

  it('listens for shared input events', () => {
    mockEngine.store.get = vi.fn(() => ({
      windowId: 'test',
      winRect: { x: 0, y: 0, w: 800, h: 600 },
      windows: {},
      layout: null,
      isLeader: false,
      permissionGranted: false,
      viewportOffset: { x: 0, y: 0 },
      sharedData: {
        input_event: { type: 'mousedown', x: 100, y: 200, windowId: 'test', timestamp: Date.now() }
      }
    }));

    const { result } = renderHook(() => useVirtualInputs(mockEngine));

    act(() => {
      // Trigger store change
      const listener = (mockEngine.store as any)._listener;
      listener();
    });

    expect(result.current).toContainEqual(
      expect.objectContaining({ type: 'mousedown' })
    );
  });
});