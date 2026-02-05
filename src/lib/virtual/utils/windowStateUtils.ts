import { VflLayout, VflScreen, Rect } from "../types/types";
import { assignScreenForWindow } from "./vfl";

/**
 * Determines the screen assignment for a window.
 * Priority: URL Parameter > Automatic Calculation
 */
export function resolveScreenAssignment(
  layout: VflLayout,
  winRect: Rect,
  urlScreenId: string | null
): string {
  // 1. URL Parameter Priority
  if (urlScreenId) {
    return urlScreenId;
  }

  // 2. Automatic Calculation
  if (layout.screens.length === 0) return "S1";

  const { screenId } = assignScreenForWindow({
    windowId: "temp",
    winRect,
    screens: layout.screens,
  });
  return screenId;
}

/**
 * Determines the window's position relative to its assigned screen.
 * Priority: URL Parameter > Calculation from Window Rect
 */
export function resolveRelativePosition(
  winRect: Rect,
  assignedScreen: VflScreen,
  urlScreenPosition: { x: number; y: number } | null
): { x: number; y: number } {
  // 1. URL Parameter Priority
  if (urlScreenPosition) {
    return urlScreenPosition;
  }

  // 2. Calculation (Global Window Position - Screen Position)
  return {
    x: winRect.x - assignedScreen.x,
    y: winRect.y - assignedScreen.y,
  };
}

/**
 * Calculates the global virtual position of the window.
 * This combines the assigned screen's position and the window's relative position.
 */
export function resolveGlobalVirtualRect(
  assignedScreen: VflScreen,
  relativePos: { x: number; y: number },
  winW: number,
  winH: number
): Rect {
  return {
    x: assignedScreen.x + relativePos.x,
    y: assignedScreen.y + relativePos.y,
    w: winW,
    h: winH,
  };
}
