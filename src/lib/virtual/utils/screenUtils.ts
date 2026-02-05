import type { VflLayout } from "../types/types";
import { normalizeLayout, decodeVflFromUrlParam } from "./vfl";

type ScreenDetails = {
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  availLeft?: number;
  availTop?: number;
  availWidth?: number;
  availHeight?: number;
  devicePixelRatio?: number;
};

export async function getVflFromScreenDetails(): Promise<VflLayout | null> {
  // Permission / support dependent
  const anyWin = window as { getScreenDetails?: () => Promise<{ screens?: ScreenDetails[] }> };
  if (!anyWin.getScreenDetails) return null;

  try {
    const details = await anyWin.getScreenDetails(); // may prompt permission
    const screens = (details.screens ?? []).map((s: ScreenDetails, i: number) => ({
      id: s.id?.toString?.() ?? `S${i + 1}`,
      x: Number(s.left ?? s.availLeft ?? 0),
      y: Number(s.top ?? s.availTop ?? 0),
      w: Number(s.width ?? s.availWidth ?? window.screen.width),
      h: Number(s.height ?? s.availHeight ?? window.screen.height),
      scale: typeof s.devicePixelRatio === "number" ? s.devicePixelRatio : undefined,
    }));
    if (!screens.length) return null;

    const vfl = normalizeLayout({ v: 1, screens });
    console.log("[VFL]", JSON.stringify(vfl, null, 2));
    return vfl;
  } catch (e) {
    console.warn("getScreenDetails failed or denied:", e);
    return null;
  }
}

export function getLayoutFromUrl(): VflLayout | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const p = url.searchParams.get("layout");
  if (!p) return null;
  return decodeVflFromUrlParam(p);
}

export function computeLayoutFromScreens(): VflLayout {
  if (typeof window === "undefined") {
    // Return a dummy layout for SSR
    return { v: 1, frame: { x: 0, y: 0, w: 1920, h: 1080 }, screens: [{ id: "S1", x: 0, y: 0, w: 1920, h: 1080 }] };
  }
  // Compute layout from screen properties (without permission)
  const scr = window.screen as Screen & { availLeft: number; availTop: number; availWidth: number; availHeight: number; };
  const availLeft = scr.availLeft ?? 0;
  const availTop = scr.availTop ?? 0;
  const availWidth = scr.availWidth;
  const availHeight = scr.availHeight;
  const screens = [
    { id: "S1", x: availLeft, y: availTop, w: availWidth, h: availHeight },
  ];
  // For multi-monitor, one could add more, but screen API is limited
  const frame = {
    x: availLeft,
    y: availTop,
    w: availWidth,
    h: availHeight,
  };
  return normalizeLayout({ v: 1, frame, screens });
}

export function getScreenIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("screenId");
  if (!param) return null;
  try {
    return decodeURIComponent(param);
  } catch {
    return null;
  }
}

export function getScreenPositionFromUrl(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("screenPosition");
  if (!param) return null;

  try {
    const decoded = decodeURIComponent(param);
    
    // 1. Try "pos1." prefix (custom format)
    if (decoded.startsWith("pos1.")) {
      try {
        const parsed = JSON.parse(decoded.slice(5));
        if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
      } catch {}
    }
    // Also check if the raw param started with pos1 before decode
    if (param.startsWith("pos1.")) {
       try {
        const parsed = JSON.parse(decodeURIComponent(param.slice(5)));
        if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
       } catch {}
    }

    // 2. Try direct JSON
    try {
      const parsed = JSON.parse(decoded);
      if (typeof parsed === 'object' && parsed !== null && 'x' in parsed && 'y' in parsed) {
         return { x: Number(parsed.x), y: Number(parsed.y) };
      }
    } catch {}

    // 3. Try "x,y" format
    const parts = decoded.split(',');
    if (parts.length === 2) {
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }
  } catch (e) {
    console.warn("Failed to parse screenPosition:", e);
  }
  return null;
}

export function encodeScreenIdToUrlParam(screenId: string): string {
  return encodeURIComponent(screenId);
}

export function encodeScreenPositionToUrlParam(pos: { x: number; y: number }): string {
  return `pos1.${encodeURIComponent(JSON.stringify(pos))}`;
}