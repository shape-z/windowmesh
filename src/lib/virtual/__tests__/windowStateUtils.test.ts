import { describe, it, expect } from 'vitest';
import { 
  resolveScreenAssignment, 
  resolveRelativePosition, 
  resolveGlobalVirtualRect 
} from '@/lib/virtual/utils/windowStateUtils';
import type { VflLayout } from '@/lib/virtual/types/types';

// Mock Data
// Use distinct sizes for S1 and S2 to allow deterministic auto-detection by size
const mockLayout: VflLayout = {
  v: 1,
  frame: { x: 0, y: 0, w: 3200, h: 1080 },
  screens: [
    { id: 'S1', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'S2', x: 1920, y: 0, w: 1280, h: 720 }
  ]
};

const mockScreenS1 = mockLayout.screens[0];
const mockScreenS2 = mockLayout.screens[1];

describe('Window Logic (windowStateUtils)', () => {

  describe('resolveScreenAssignment', () => {
    it('PRIORITY Handling: URL > Auto', () => {
      // Window size matches S2 (1280x720), but URL forces S1
      const winRect = { x: 2000, y: 100, w: 1280, h: 720 };
      expect(resolveScreenAssignment(mockLayout, winRect, 'S1')).toBe('S1');
    });

    it('fallback to auto-detection based on dimensions if URL is missing', () => {
      // Window size matches S2 (1280x720) exactly
      const winRect = { x: 0, y: 0, w: 1280, h: 720 };
      expect(resolveScreenAssignment(mockLayout, winRect, null)).toBe('S2');
    });

    it('handles unknown screens gracefully (defaults to best fit S1)', () => {
      // Window size matches S1 (1920x1080) exactly
      const winRect = { x: 0, y: 0, w: 1920, h: 1080 };
      expect(resolveScreenAssignment(mockLayout, winRect, null)).toBe('S1');
    });
  });

  describe('resolveRelativePosition', () => {
    it('PRIORITY Handling: URL > Auto', () => {
      const winRect = { x: 3000, y: 300, w: 500, h: 500 }; // Physically here
      // But URL claims 0,0 relative
      expect(resolveRelativePosition(winRect, mockScreenS2, {x:0, y:0})).toEqual({x:0, y:0});
    });

    it('calculates correct relative position on primary screen (S1)', () => {
      const winRect = { x: 100, y: 50, w: 500, h: 500 };
      // S1 is at 0,0
      expect(resolveRelativePosition(winRect, mockScreenS1, null)).toEqual({x:100, y:50});
    });

    it('calculates correct relative position on secondary screen (S2)', () => {
      const winRect = { x: 2020, y: 50, w: 500, h: 500 };
      // S2 is at 1920,0.  x = 2020 - 1920 = 100
      expect(resolveRelativePosition(winRect, mockScreenS2, null)).toEqual({x:100, y:50});
    });
  });

  describe('resolveGlobalVirtualRect', () => {
    it('maps relative pos back to global space (S1)', () => {
      // Relative 50,50 on S1 (0,0) -> Global 50,50
      expect(resolveGlobalVirtualRect(mockScreenS1, {x:50,y:50}, 100, 100)).toEqual({
        x: 50, y: 50, w: 100, h: 100
      });
    });

    it('maps relative pos back to global space (S2)', () => {
      // Relative 50,50 on S2 (1920,0) -> Global 1970, 50
      expect(resolveGlobalVirtualRect(mockScreenS2, {x:50,y:50}, 100, 100)).toEqual({
        x: 1970, y: 50, w: 100, h: 100
      });
    });
  });
});
