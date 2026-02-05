import { useContext, useState, useEffect } from 'react';
import { VirtualCtx } from './virtualContext';

export type Coordinates = {
  x: number;
  y: number;
};

/**
 * @brief Converts local coordinates (e.g., clientX, clientY) to global virtual coordinates.
 * @param localX The local X coordinate.
 * @param localY The local Y coordinate.
 * @param viewportOffset The current viewport offset from VirtualCtx.
 * @return The global coordinates.
 */
export function localToGlobal(localX: number, localY: number, viewportOffset: { x: number; y: number }): Coordinates {
  return {
    x: localX + viewportOffset.x,
    y: localY + viewportOffset.y,
  };
}

/**
 * @brief Converts global virtual coordinates to local coordinates relative to the current viewport.
 * @param globalX The global X coordinate.
 * @param globalY The global Y coordinate.
 * @param viewportOffset The current viewport offset from VirtualCtx.
 * @return The local coordinates.
 */
export function globalToLocal(globalX: number, globalY: number, viewportOffset: { x: number; y: number }): Coordinates {
  return {
    x: globalX - viewportOffset.x,
    y: globalY - viewportOffset.y,
  };
}

/**
 * @brief Hook that provides the current global mouse coordinates in the virtual viewport.
 * Updates on mouse movements and uses VirtualCtx for offset.
 * @return The current mouse coordinates or null if not available.
 */
export function useVirtualMouseCoordinates(): Coordinates | null {
  const ctx = useContext(VirtualCtx);
  const [mousePos, setMousePos] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!ctx) return;

    const viewportOffset = ctx.viewportOffset || { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const globalPos = localToGlobal(e.clientX, e.clientY, viewportOffset);
      setMousePos(globalPos);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [ctx?.viewportOffset, ctx]);

  return mousePos;
}

/**
 * @brief Converts global virtual coordinates to window coordinates (screenX, screenY).
 * Uses the frame origin from VirtualCtx layout.
 * @param globalX The global X coordinate.
 * @param globalY The global Y coordinate.
 * @param frame The frame origin from layout.
 * @return The window coordinates.
 */
export function virtualToWindow(globalX: number, globalY: number, frame: { x: number; y: number }): Coordinates {
  return {
    x: globalX + frame.x,
    y: globalY + frame.y,
  };
}

/**
 * @brief Converts window coordinates (screenX, screenY) to global virtual coordinates.
 * Uses the frame origin from VirtualCtx layout.
 * @param screenX The screen X coordinate.
 * @param screenY The screen Y coordinate.
 * @param frame The frame origin from layout.
 * @return The global virtual coordinates.
 */
export function windowToVirtual(screenX: number, screenY: number, frame: { x: number; y: number }): Coordinates {
  return {
    x: screenX - frame.x,
    y: screenY - frame.y,
  };
}