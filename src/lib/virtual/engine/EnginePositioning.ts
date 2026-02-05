import type { VflLayout, VflScreen, Rect } from "../types/types";
import { decodeVflFromUrlParam, assignScreenForWindow } from "../utils/vfl";
import {
  getScreenIdFromUrl,
  getScreenPositionFromUrl,
} from "../utils/screenUtils";

// ==========================================
// Coordinate & Positioning Logic
// ==========================================

/**
 * @brief Extracts static layout configuration from the current URL parameters.
 * @returns Parsed VflLayout object or null if not present.
 */
export function getStaticLayoutFromUrl(): VflLayout | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const layoutParam = url.searchParams.get("layout");
  if (!layoutParam) return null;
  return decodeVflFromUrlParam(layoutParam);
}

/**
 * @brief Calculates which virtual screen a window belongs to.
 *
 * Priority:
 * 1. URL Parameter (Explicit assignment)
 * 2. Geometry Overlap (Automatic detection based on position)
 *
 * @param windowId The ID of the window.
 * @param winRect The current rectangle of the window.
 * @param screens Available virtual screens.
 * @returns The assigned VflScreen.
 */
export function calculateAssignedScreen(
  windowId: string,
  winRect: Rect,
  screens: VflScreen[]
): VflScreen {
  // A. URL Check
  const urlScreenId = getScreenIdFromUrl();
  if (urlScreenId) {
    const match = screens.find((s) => s.id === urlScreenId);
    if (match) return match;
  }

  // B. Geometry Check (Fallback)
  let physicalScreenSize: { w: number; h: number } | undefined;
  if (typeof window !== "undefined" && window.screen) {
    physicalScreenSize = { w: window.screen.width, h: window.screen.height };
  }

  const assignment = assignScreenForWindow({
    windowId,
    winRect,
    screens,
    physicalScreenSize,
  });
  return screens.find((s) => s.id === assignment.screenId) || screens[0];
}

/**
 * @brief Calculates the position of the window relative to its assigned screen.
 *
 * Priority:
 * 1. URL Parameter
 * 2. Geometric difference between window and screen definition.
 *
 * @param winRect Current window rectangle.
 * @param screen The assigned virtual screen.
 * @returns {x, y} coordinate offset.
 */
export function calculateRelativePosition(
  winRect: Rect,
  screen: VflScreen
): { x: number; y: number } {
  // A. URL Check
  const urlPos = getScreenPositionFromUrl();
  if (urlPos) {
    return urlPos;
  }

  return {
    x: winRect.x - screen.x,
    y: winRect.y - screen.y,
  };
}

/**
 * @brief Calculates the absolute global position of the window in the virtual space.
 * 
 * Logic: Screen Virtual Position + Relative Window Offset.
 * 
 * @param screen The assigned virtual screen.
 * @param relativePos The relative offset calculated previously.
 * @param winW Window width.
 * @param winH Window height.
 * @returns Global Rect in virtual coordinates.
 */
export function calculateGlobalPosition(
  screen: VflScreen,
  relativePos: { x: number; y: number },
  winW: number,
  winH: number
): Rect {
  return {
    x: screen.x + relativePos.x,
    y: screen.y + relativePos.y,
    w: winW,
    h: winH,
  };
}

