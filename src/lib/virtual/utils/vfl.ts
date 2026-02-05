import { z } from "zod";
import type { Rect, VflLayout, VflScreen } from "../types/types";

const RectZ = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const ScreenZ = RectZ.extend({
  id: z.string().min(1),
  scale: z.number().optional(),
});

const LayoutZ = z.object({
  v: z.literal(1),
  frame: RectZ,
  screens: z.array(ScreenZ).min(1),
});

export function unionRects(rects: Rect[]): Rect {
  const xs = rects.map((r) => r.x);
  const ys = rects.map((r) => r.y);
  const x2 = rects.map((r) => r.x + r.w);
  const y2 = rects.map((r) => r.y + r.h);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...x2);
  const maxY = Math.max(...y2);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function normalizeLayout(layout: Omit<VflLayout, "frame"> & { frame?: Rect }): VflLayout {
  const frame = layout.frame ?? unionRects(layout.screens);
  const normalized: VflLayout = { v: 1, frame, screens: layout.screens };
  LayoutZ.parse(normalized);
  return normalized;
}

/**
 * URL-Format: layout=vfl1.<urlencoded(json)>
 */
export function encodeVflToUrlParam(layout: VflLayout): string {
  LayoutZ.parse(layout);
  const json = JSON.stringify(layout);
  return `vfl1.${encodeURIComponent(json)}`;
}

export function decodeVflFromUrlParam(param: string): VflLayout | null {
  if (!param?.startsWith("vfl1.")) return null;
  const payload = param.slice("vfl1.".length);
  try {
    const json = decodeURIComponent(payload);
    const parsed = JSON.parse(json);
    const layout = LayoutZ.parse(parsed) as VflLayout;
    return layout;
  } catch {
    return null;
  }
}

export function rectIntersection(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function area(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizedSizeDistance(a: { w: number; h: number }, b: { w: number; h: number }): number {
  // relative difference (0..1+) then clamp to 0..1
  const dw = Math.abs(a.w - b.w) / Math.max(a.w, b.w);
  const dh = Math.abs(a.h - b.h) / Math.max(a.h, b.h);
  return clamp01((dw + dh) / 2);
}

// stable "random" tie-breaker (deterministic)
export function stableRand01(key: string): number {
  // simple FNV-1a-ish hash
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Calculates similarity between two dimensions.
 * Returns a score between 0 (different) and 1 (identical).
 */
function calculateDimensionSimilarity(a: { w: number; h: number }, b: { w: number; h: number }): number {
  if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return 0;
  
  // Calculate relative difference for width and height
  const dw = Math.abs(a.w - b.w) / Math.max(a.w, b.w);
  const dh = Math.abs(a.h - b.h) / Math.max(a.h, b.h);
  
  // Average difference
  const diff = (dw + dh) / 2;
  
  // Return score (1 - diff), clamped to 0..1
  return Math.max(0, 1 - diff);
}

/**
 * Assign window to one screen based on similarity of dimensions.
 * 1. Try physical screen size (window.screen) match
 * 2. Fallback to window size (window.innerWidth/Height) match
 */
export function assignScreenForWindow(args: {
  windowId: string;
  winRect: Rect;
  screens: VflScreen[];
  physicalScreenSize?: { w: number; h: number };
  similarityThreshold?: number; // fallback threshold, e.g. 0.8
}): { screenId: string; score: number } {
  const { windowId, winRect, screens, physicalScreenSize, similarityThreshold = 0.8 } = args;

  // 1. Fallback: Try physical screen size if available (Dimension Matching)
  const findBestScreen = (targetSize: { w: number; h: number }) => {
    let best = { screenId: screens[0]?.id, score: -1, tie: 0 };
    
    for (const s of screens) {
      const score = calculateDimensionSimilarity(targetSize, { w: s.w, h: s.h });
      const tie = stableRand01(`${windowId}:${s.id}`);
      
      if (score > best.score) {
        best = { screenId: s.id, score, tie };
      } else if (score === best.score) { // Exact float match rare, but possible if score is 0 or 1
        if (tie < best.tie) best = { screenId: s.id, score, tie };
      }
    }
    return best;
  };

  // 1. Try physical screen size if available
  if (physicalScreenSize && physicalScreenSize.w > 0 && physicalScreenSize.h > 0) {
    const layoutMatch = findBestScreen(physicalScreenSize);
    
    // If good enough match, use it
    if (layoutMatch.score >= similarityThreshold) {
      return { screenId: layoutMatch.screenId, score: layoutMatch.score };
    }
  }

  // 2. Fallback: Use window size (winRect)
  const windowMatch = findBestScreen({ w: winRect.w, h: winRect.h });
  return { screenId: windowMatch.screenId, score: windowMatch.score };
}
