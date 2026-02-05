/**
 * Utility functions for virtual viewport management
 */

/**
 * Executes a function only once, regardless of how many times it's called.
 * Subsequent calls return undefined.
 */
export function once<T extends (...args: unknown[]) => unknown>(fn: T): T {
  let called = false;
  let result: unknown;

  return ((...args: Parameters<T>) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  }) as T;
}

/**
 * Executes a function only if this is the first browser instance.
 * Uses sessionStorage to determine if it's the first instance.
 */
export function oncePerSession<T extends (...args: never[]) => unknown>(fn: T): T {
  const key = 'vwin:firstBrowserExecuted';
  return ((...args: Parameters<T>) => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, 'true');
      return fn(...args);
    }
  }) as T;
}

/**
 * Debounces a function call.
 */
export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

import type { Rect, WindowSnapshot } from "../types/types";

export function getCurrentWindowRect(): Rect {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, w: 1920, h: 1080 };
  }
  return {
    x: window.screenX,
    y: window.screenY,
    w: window.innerWidth,
    h: window.innerHeight,
  };
}

/**
 * Throttles a function call.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallTime >= interval) {
      lastCallTime = now;
      fn(...args);
    }
  };
}

/**
 * Determines the master window ID based on the lowest ID in the windows registry.
 * @param windows - The windows registry object.
 * @param fallbackWindowId - Fallback window ID if no windows are registered.
 * @returns The master window ID as a string.
 */
export function getMasterWindowId(windows: Record<string, WindowSnapshot>, fallbackWindowId: string = ''): string {
  const allWindowIds = Object.keys(windows);
  if (allWindowIds.length === 0) return fallbackWindowId;
  // Sort alphabetically and take the first (lowest)
  allWindowIds.sort();
  return allWindowIds[0];
}

/**
 * Checks if the current window is the master.
 * @param windowId - The current window ID.
 * @param windows - The windows registry object.
 * @returns True if the current window is the master, false otherwise.
 */
export function isMasterWindow(windowId: string, windows: Record<string, WindowSnapshot>): boolean {
  const masterId = getMasterWindowId(windows, windowId);
  return windowId === masterId;
}