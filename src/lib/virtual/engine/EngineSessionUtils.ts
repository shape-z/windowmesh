import type { Rect } from "../types/types";

// ==========================================
// Session & ID Utilities
// ==========================================

/**
 * @brief Generates a deterministic session ID based on a layout string.
 *
 * This allows multiple tabs opening the same "layout" to find each other
 * in the same session, even if they don't share a parent opening context.
 *
 * @param layoutString The stringified layout configuration.
 * @returns A promise resolving to the session ID (e.g. "vwin:a1b2c3").
 */
export async function generateSessionId(layoutString: string): Promise<string> {
  if (!layoutString) return "default";

  // Simple hash for older browsers or non-secure contexts
  let hash = 0;
  for (let i = 0; i < layoutString.length; i++) {
    const char = layoutString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return "vwin:" + (hash >>> 0).toString(16);
}

/**
 * @brief Checks if a rectangle has valid dimensions.
 * 
 * @param r The rectangle to check.
 * @returns True if width and height are > 0.
 */
export function isValidRect(r: Rect): boolean {
  return r.w > 0 && r.h > 0;
}

