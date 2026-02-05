import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualStore, useVirtualState } from '../hooks/useVirtualStore';
import type { VirtualEngine } from '../engine/VirtualEngine';

const initialState = {
  windowId: 'test',
  winRect: { x: 0, y: 0, w: 800, h: 600 },
  windows: {},
  layout: null,
  isLeader: false,
  permissionGranted: false,
  viewportOffset: { x: 0, y: 0 },
  sharedData: {}
};

describe('useVirtualStore', () => {
  let mockEngine: VirtualEngine;
  
  beforeEach(() => {
    mockEngine = {
      store: {
        subscribe: vi.fn((listener) => {
          (mockEngine.store as any)._listener = listener;
          return vi.fn();
        }),
        get: vi.fn(() => initialState)
      }
    } as any;
  });

  it('returns selected state', () => {
    const { result } = renderHook(() =>
      useVirtualStore(mockEngine, (state) => state.windowId)
    );
    expect(result.current).toBe('test');
  });

  it('returns null if engine is null', () => {
    const { result } = renderHook(() =>
      useVirtualStore(null, (state) => state.windowId)
    );
    expect(result.current).toBeNull();
  });

  it('updates on store changes', () => {
    const { result } = renderHook(() =>
      useVirtualStore(mockEngine, (state) => state.windowId)
    );

    act(() => {
      // Simulate store change
      mockEngine.store.get = vi.fn(() => ({
        windowId: 'updated',
        winRect: { x: 0, y: 0, w: 800, h: 600 },
        windows: {},
        layout: null,
        isLeader: false,
        permissionGranted: false,
        viewportOffset: { x: 0, y: 0 },
        sharedData: {}
      }));
      const listener = (mockEngine.store as any)._listener;
      listener();
    });

    expect(result.current).toBe('updated');
  });
});

describe('useVirtualState', () => {
  let mockEngine: VirtualEngine;

  beforeEach(() => {
    mockEngine = {
      store: {
        subscribe: vi.fn((listener) => {
          (mockEngine.store as any)._listener = listener;
          return vi.fn();
        }),
        get: vi.fn(() => initialState)
      }
    } as any;
  });

  it('returns full state', () => {
    const { result } = renderHook(() => useVirtualState(mockEngine));
    expect(result.current).toEqual({
      windowId: 'test',
      winRect: { x: 0, y: 0, w: 800, h: 600 },
      windows: {},
      layout: null,
      isLeader: false,
      permissionGranted: false,
      viewportOffset: { x: 0, y: 0 },
      sharedData: {}
    });
  });

  it('returns null if engine is null', () => {
    const { result } = renderHook(() => useVirtualState(null));
    expect(result.current).toBeNull();
  });
});