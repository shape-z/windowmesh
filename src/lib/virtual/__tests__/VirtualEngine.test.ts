import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VirtualEngine } from '../engine/VirtualEngine';
import type { Rect, VflLayout } from '../types/types';

// Mock dependencies
const { mockNetworkAdapter, mockNormalizeLayout, mockGenerateSessionId, mockGetStaticLayoutFromUrl, mockCalculateAssignedScreen, mockCalculateRelativePosition, mockCalculateGlobalPosition } = vi.hoisted(() => {
  return {
    mockNetworkAdapter: {
      broadcast: vi.fn(),
      onMessage: vi.fn(() => vi.fn()),
      close: vi.fn()
    },
    mockNormalizeLayout: vi.fn(),
    mockGenerateSessionId: vi.fn(() => Promise.resolve('test-session')),
    mockGetStaticLayoutFromUrl: vi.fn(() => null as any),
    mockCalculateAssignedScreen: vi.fn(),
    mockCalculateRelativePosition: vi.fn(),
    mockCalculateGlobalPosition: vi.fn()
  };
});

vi.mock('../engine/EngineNetworkAdapter', () => ({
  NetworkAdapter: vi.fn(function() { return mockNetworkAdapter; })
}));

vi.mock('../utils/vfl', () => ({
  normalizeLayout: mockNormalizeLayout
}));

vi.mock('../engine/EngineSessionUtils', () => ({
  generateSessionId: mockGenerateSessionId
}));

vi.mock('../engine/EnginePositioning', () => ({
  getStaticLayoutFromUrl: mockGetStaticLayoutFromUrl,
  calculateAssignedScreen: mockCalculateAssignedScreen,
  calculateRelativePosition: mockCalculateRelativePosition,
  calculateGlobalPosition: mockCalculateGlobalPosition
}));

describe('VirtualEngine', () => {
  let engine: VirtualEngine;
  const windowId = 'test-window';
  const initialRect: Rect = { x: 0, y: 0, w: 800, h: 600 };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetStaticLayoutFromUrl.mockReturnValue(null); // Reset to default
    vi.useFakeTimers();
    engine = new VirtualEngine(windowId, initialRect);
    
    // Wait for async network initialization
    // Poll until network property is populated or timeout
    let ticks = 0;
    while (!(engine as any).network && ticks < 20) {
      await Promise.resolve();
      ticks++;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('initializes with correct state', () => {
      expect(engine.store.get().windowId).toBe(windowId);
      expect(engine.store.get().winRect).toEqual(initialRect);
    });

    it('sets static layout if available', () => {
      mockGetStaticLayoutFromUrl.mockReturnValue({ v: 1, frame: { x: 0, y: 0, w: 1920, h: 1080 }, screens: [] });
      const newEngine = new VirtualEngine(windowId, initialRect);
      expect(newEngine.store.get().layout).not.toBeNull();
    });
  });

  describe('setSharedData()', () => {
    it('updates shared data and broadcasts', () => {
      engine.setSharedData('testKey', 'testValue');
      expect(engine.store.get().sharedData?.testKey).toBe('testValue');
      expect(mockNetworkAdapter.broadcast).toHaveBeenCalled();
    });
  });

  describe('handleMessage - HELLO', () => {
    it('adds window to registry', () => {
      const winData = { id: 'win1', rect: { x: 0, y: 0, w: 100, h: 100 } };
      (engine as any).networkSystem.handleMessage({ 
        type: 'HELLO', 
        payload: { ...winData, lastSeen: Date.now(), timestamp: Date.now() } 
      });
      expect(engine.store.get().windows['win1']).toBeDefined();
    });
  });

  describe('handleMessage - GOODBYE', () => {
    it('removes window from registry', () => {
      // Setup
      (engine as any).networkSystem.handleMessage({ 
        type: 'HELLO', 
        payload: { id: 'win1', rect: { x: 0, y: 0, w: 100, h: 100 }, lastSeen: Date.now(), timestamp: Date.now() } 
      });

      // Act
      (engine as any).networkSystem.handleMessage({ 
        type: 'GOODBYE', 
        payload: { id: 'win1' } 
      });

      expect(engine.store.get().windows['win1']).toBeUndefined();
    });
  });

  describe('updateRect', () => {
    it('updates winRect in store and recalculates', () => {
      const newRect = { x: 10, y: 10, w: 100, h: 100 };
      engine.updateRect(newRect);
      expect(engine.store.get().winRect).toEqual(newRect);
      // publishSelf called -> broadcast HEARTBEAT
      expect(mockNetworkAdapter.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'HEARTBEAT' })
      );
    });

    it('recalculates world if leader', () => {
       engine.store.set({ isLeader: true });
       const newRect = { x: 20, y: 20, w: 200, h: 200 };
       engine.updateRect(newRect);
       expect(mockNormalizeLayout).toHaveBeenCalled();
    });
  });

  describe('handleMessage - SHARED_DATA_UPDATE', () => {
    it('updates shared data store', () => {
       (engine as any).networkSystem.handleMessage({
        type: 'SHARED_DATA_UPDATE',
        payload: { key: 'foo', value: 'bar' }
      });
      expect(engine.store.get().sharedData['foo']).toBe('bar');
    });
  });
  
  describe('handleMessage - LAYOUT_UPDATE', () => {
    it('updates layout if not leader', () => {
      // Ensure we are NOT leader
      engine.store.set({ isLeader: false });
      
      const newLayout = { v: 1, frame: { x:0, y:0, w:1000, h:1000 }, screens: [] };
      (engine as any).networkSystem.handleMessage({
        type: 'LAYOUT_UPDATE',
        payload: newLayout
      });
      
      expect(engine.store.get().layout).toEqual(newLayout);
    });

    it('ignores layout update if leader', () => {
       engine.store.set({ isLeader: true });
       const initialLayout = engine.store.get().layout;
       
       const newLayout = { v: 1, frame: { x:0, y:0, w:1000, h:1000 }, screens: [] };
       (engine as any).networkSystem.handleMessage({
        type: 'LAYOUT_UPDATE',
        payload: newLayout
      });
      
      expect(engine.store.get().layout).toBe(initialLayout);
    });
  });

  describe('recalculateLocalView interaction', () => {
    it('calculates global position using positioning utils', () => {
       // Setup active layout via store (fake a Layout UPDATE)
       const fakeLayout: VflLayout = { 
           v: 1, 
           frame: { x: 0, y: 0, w: 1000, h: 1000 }, 
           screens: [
               { id: 's1', x: 0, y: 0, w: 500, h: 500 }
           ] 
       };
       engine.store.set({ layout: fakeLayout });

       // Setup Mocks
       const fakeScreen = { id: 's1', x: 0, y: 0, w: 500, h: 500 };
       const fakeRel = { x: 10, y: 10 };
       const fakeGlobal = { x: 100, y: 100, w: 100, h: 100 };

       mockCalculateAssignedScreen.mockReturnValue(fakeScreen);
       mockCalculateRelativePosition.mockReturnValue(fakeRel);
       mockCalculateGlobalPosition.mockReturnValue(fakeGlobal);

       // Act: Trigger calculation (e.g. via updateRect)
       engine.updateRect({ x: 50, y: 50, w: 100, h: 100 });

       // Assert
       expect(mockCalculateAssignedScreen).toHaveBeenCalled();
       expect(mockCalculateRelativePosition).toHaveBeenCalled();
       expect(mockCalculateGlobalPosition).toHaveBeenCalled();
       
       const state = engine.store.get();
       // GlobalRect (virtualRect) should be set
       expect(state.virtualRect).toEqual(fakeGlobal);
       // ViewportOffset should be derived from globalRect (x:100) vs frame.x (0) => 100
       // Implementation logic: viewportOffset = globalVirtualRect.x - frame.x ?? No, check impl.
       // Impl: viewportOffset: { x: globalVirtualRect.x - frameX, y: globalVirtualRect.y - frameY }
       expect(state.viewportOffset).toEqual({ x: 100, y: 100 });
    });
  });

  describe('leader election', () => {
    it('becomes leader if first window', () => {
      vi.advanceTimersByTime(100); // Trigger heartbeat
      expect(mockNetworkAdapter.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'HEARTBEAT' })
      );
    });

    it('handles leader timeout', () => {
      // Simulate another window becoming leader
      (engine as any).networkSystem.handleMessage({
        type: 'HEARTBEAT',
        payload: { id: 'other-window', rect: { x: 0, y: 0, w: 100, h: 100 }, lastSeen: Date.now(), timestamp: Date.now() }
      });

      // Advance time past timeout
      vi.advanceTimersByTime(4000);

      // Should attempt to become leader (impl check: might broadcast LEADER_CLAIM or HEARTBEAT if it thinks it's leader)
      // Assuming naive implementation tries to claim leadership
      expect(mockNetworkAdapter.broadcast).toHaveBeenCalled();
    });
  });


  describe('handleMessage - LEADER_CLAIM', () => {
    it('step down if another leader claims', () => {
       // Assume we are leader
       engine.store.set({ isLeader: true });
       
       (engine as any).networkSystem.handleMessage({
        type: 'LEADER_CLAIM',
        payload: { id: 'other-leader', timestamp: Date.now() }
       });
       
       expect(engine.store.get().isLeader).toBe(false);
    });
  });

  describe('handleMessage - HELLO (as leader)', () => {
    it('recalculates world if leader', () => {
      engine.store.set({ isLeader: true });
      
      const winData = { id: 'win1', rect: { x: 0, y: 0, w: 100, h: 100 } };
      (engine as any).networkSystem.handleMessage({ 
        type: 'HELLO', 
        payload: { ...winData, lastSeen: Date.now(), timestamp: Date.now() } 
      });
      
      expect(mockNormalizeLayout).toHaveBeenCalled();
    });

    it('ignores empty screen windows during layout calc', () => {
       engine.store.set({ isLeader: true });
       
       // Advance time to ensure publishSelf generates a new timestamp
       vi.advanceTimersByTime(10);
       
       // 1. Set self to 0 size first to prevent it from triggering layout
       engine.updateRect({ x:0, y:0, w:0, h:0 });
       
       // 2. Clear any calls that might have happened during setup/updateRect
       mockNormalizeLayout.mockClear();

       // 3. Add a window with 0 size
       const winData = { id: 'ghost', rect: { x:0, y:0, w:0, h:0 } };
       (engine as any).networkSystem.handleMessage({
           type: 'HELLO',
            payload: { ...winData, lastSeen: Date.now(), timestamp: Date.now() } 
       });

       // Both self and new window are 0 size.
       expect(mockNormalizeLayout).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('cleans up resources', async () => {
        // Just ensure it doesn't throw and calls expected cleanups
        engine.dispose();
        expect(mockNetworkAdapter.close).toHaveBeenCalled();
        expect(mockNetworkAdapter.broadcast).toHaveBeenCalledWith(
           expect.objectContaining({ type: 'GOODBYE' })
        );
    });

    it('removes timed out windows', async () => {
      // Wait for async init
      await Promise.resolve();
      await Promise.resolve();
      
      (engine as any).networkSystem.handleMessage({ 
        type: 'HELLO', 
        payload: { id: 'win1', rect: { x: 0, y: 0, w: 100, h: 100 }, lastSeen: Date.now(), timestamp: Date.now() } 
      });

      // Advance time past cleanup interval (checking every 5000ms)
      // At t=5000, diff=5000 (not > 5000). Next check at 10000.
      vi.advanceTimersByTime(11000);

      expect(engine.store.get().windows['win1']).toBeUndefined();
    });
  });

  describe('Static Layout Mode', () => {
    it('enforces static layout on recalculateWorld (via window join)', async () => {
       // Mock static layout
       const staticLayout = {
         v: 1,
         frame: { x:0, y:0, w:1000, h:1000 },
         screens: [
           { id: 'screen1', x: 0, y: 0, w: 100, h: 100 }
         ]
       } as const; // Cast for type safety if needed
       
       // Re-mock return value and create meaningful engine
       mockGetStaticLayoutFromUrl.mockReturnValue(staticLayout);
       
       const staticEngine = new VirtualEngine('static-win', { x:0, y:0, w:800, h:600 });
       
       // Wait for async init
       let ticks = 0;
       while (!(staticEngine as any).network && ticks < 20) {
          await Promise.resolve();
          ticks++;
       }

       staticEngine.store.set({ isLeader: true });

       // Clear previous broadcast calls (from init)
       mockNetworkAdapter.broadcast.mockClear();

       // Trigger recalculation via HELLO ( simulates new window joining )
       (staticEngine as any).networkSystem.handleMessage({
         type: 'HELLO',
         payload: { 
            id: 'new-window', 
            rect: { x:0, y:0, w:100, h:100 },
            lastSeen: Date.now(),
            timestamp: Date.now()
         }
       });

       expect(mockNetworkAdapter.broadcast).toHaveBeenCalledWith(
          expect.objectContaining({
             type: 'LAYOUT_UPDATE',
             payload: staticLayout
          })
       );
    });
  });
});