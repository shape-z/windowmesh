import { useMemo } from "react";
import type { VflLayout, Rect } from "../types/types";
import { getScreenIdFromUrl, getScreenPositionFromUrl } from "../utils/screenUtils";
import { resolveScreenAssignment, resolveRelativePosition, resolveGlobalVirtualRect } from "../utils/windowStateUtils";

export function useViewportOffset(layout: VflLayout | null, winRect: Rect) {
  
  // Calculate derived state synchronously during render.
  // This ensures that VirtualViewportProvider passes the correct virtualRect to useRegistry
  // immediately on the first render, preventing the "wrong initial position" glitch.
  const derivedState = useMemo(() => {
    // 1. URL Parameters
    const screenIdFromUrl = getScreenIdFromUrl();
    const positionFromUrl = getScreenPositionFromUrl();

    if (screenIdFromUrl) console.log(`[useViewportOffset] URL Override: ScreenID=${screenIdFromUrl}`);
    if (positionFromUrl) console.log(`[useViewportOffset] URL Override: Position=(${positionFromUrl.x}, ${positionFromUrl.y})`);

    // 2. Active Layout or Fallback
    const activeLayout: VflLayout = layout ?? {
      v: 1,
      frame: { x: winRect.x, y: winRect.y, w: winRect.w, h: winRect.h },
      screens: [
        { id: "S1", x: winRect.x, y: winRect.y, w: winRect.w, h: winRect.h },
      ],
    };

    // 3. Resolve Screen Assignment (Centralized)
    const targetScreenId = resolveScreenAssignment(activeLayout, winRect, screenIdFromUrl);

    // 4. Resolve Relative Position & Global Virtual Rect (Centralized)
    const assignedScreen = activeLayout.screens.find(s => s.id === targetScreenId) || activeLayout.screens[0];
    
    // Position relative to the screen (top-left)
    const relativePos = resolveRelativePosition(winRect, assignedScreen, positionFromUrl);
    
    // Absolute position in the virtual world
    const globalVirtualRect = resolveGlobalVirtualRect(assignedScreen, relativePos, winRect.w, winRect.h);

    // 5. Compute Viewport Offset (Global Virtual Pos - Frame Pos)
    const frameX = activeLayout.frame?.x ?? 0;
    const frameY = activeLayout.frame?.y ?? 0;
    
    const targetOffset = {
      x: globalVirtualRect.x - frameX,
      y: globalVirtualRect.y - frameY
    };

    return {
      viewportOffset: targetOffset,
      assignedScreenId: targetScreenId,
      virtualRect: globalVirtualRect
    };

  }, [layout, winRect]);

  return derivedState;
}