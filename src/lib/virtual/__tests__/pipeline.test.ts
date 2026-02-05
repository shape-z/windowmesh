import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getScreenIdFromUrl, 
  getScreenPositionFromUrl, 
} from '@/lib/virtual/utils/screenUtils';
import { resolveScreenAssignment, resolveRelativePosition, resolveGlobalVirtualRect } from '@/lib/virtual/utils/windowStateUtils';
import type { VflLayout, Rect } from '@/lib/virtual/types/types';

// Integration Logic Simulator
// Since we can't easily spin up multiple Next.js pages in unit tests,
// we simulate the data flow that happens from URL -> Components -> Broadcast

describe('Pipeline Integration: URL to Virtual State', () => {

  const layout: VflLayout = {
    v: 1,
    frame: { x: 0, y: 0, w: 3840, h: 1080 },
    screens: [
      { id: 'S1', x: 0, y: 0, w: 1920, h: 1080 },
      { id: 'S2', x: 1920, y: 0, w: 1920, h: 1080 }
    ]
  };

  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '', searchParams: new URLSearchParams(), origin: 'http://test', pathname: '/' },
      writable: true
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('Pipeline Scenario 1: User forces Screen 2 at Top-Left', () => {
    // 1. Simulate URL Input
    // "I want this window on Screen 2, at position 0,0" (Top left of right screen)
    const jsonPos = JSON.stringify({x:0,y:0});
    window.location.href = `http://test/?screenId=S2&screenPosition=pos1.${encodeURIComponent(jsonPos)}`;

    // 2. Parse Step
    const screenId = getScreenIdFromUrl();
    const pos = getScreenPositionFromUrl();

    expect(screenId).toBe('S2');
    expect(pos).toEqual({x:0, y:0});

    // 3. Resolve Logic (simulating what useViewportOffset uses)
    // Physical window might be anywhere, e.g. at 100,100 (S1)
    const physicalRect: Rect = { x: 100, y: 100, w: 1920, h: 1080 };

    const resolvedScreenId = resolveScreenAssignment(layout, physicalRect, screenId);
    const assignedScreen = layout.screens.find(s => s.id === resolvedScreenId)!;
    
    expect(resolvedScreenId).toBe('S2');
    expect(assignedScreen.id).toBe('S2');

    const relativePos = resolveRelativePosition(physicalRect, assignedScreen, pos);
    expect(relativePos).toEqual({x:0,y:0});

    const globalRect = resolveGlobalVirtualRect(assignedScreen, relativePos, physicalRect.w, physicalRect.h);
    
    // 4. Final Verification
    // Should be at 1920, 0 (Start of S2)
    expect(globalRect).toEqual({
      x: 1920, 
      y: 0,
      w: 1920,
      h: 1080
    });
  });

  it('Pipeline Scenario 2: No URL params (Auto-Detect)', () => {
    window.location.href = `http://test/`;

    // Window physically on S2 center
    const physicalRect = { x: 1920 + 100, y: 100, w: 800, h: 600 };

    const sIdParts = getScreenIdFromUrl();
    const posParts = getScreenPositionFromUrl();

    const resolvedScreenId = resolveScreenAssignment(layout, physicalRect, sIdParts);
    expect(resolvedScreenId).toBe('S2'); // Auto-detected S2

    const assignedScreen = layout.screens.find(s => s.id === resolvedScreenId)!;
    const relativePos = resolveRelativePosition(physicalRect, assignedScreen, posParts);
    
    expect(relativePos).toEqual({x:100, y:100}); // Relative to 1920,0

    const globalRect = resolveGlobalVirtualRect(assignedScreen, relativePos, 800, 600);
    expect(globalRect).toEqual({x: 2020, y: 100, w: 800, h: 600});
  });
});
