"use client";

import React, { useContext, useEffect, useRef, useCallback, useMemo } from "react";
import { VirtualCtx } from "@/lib/virtual/extensions/virtualContext";
import { TimeManager } from "@/lib/virtual/extensions/timeManager";
import { EventManager } from "@/lib/virtual/extensions/eventManager";
import type { VirtualEngine } from "@/lib/virtual/engine/VirtualEngine";

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

/** Flat grid stored as Uint8Array for compact sync (0 = dead, 1 = alive). */
type GridData = number[]; // JSON-serialisable for sharedData

type GameSharedData = {
  /** Flat grid (row-major). */
  golGrid?: GridData;
  /** Virtual-world grid dimensions (cells, not pixels). */
  golCols?: number;
  golRows?: number;
  /** Running iteration counter (shared). */
  golIteration?: number;
  /** Epoch ms when the current round started. */
  golRoundStart?: number;
  /** Per-cell base hue (flat, parallel to golGrid). -1 = dead / no hue. */
  golCellHues?: number[];
  /** Background color. */
  bgColor?: string;
};

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 500; // 2 iterations / second
const ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PIXELS_PER_CELL = 10;
const ALIVE_PROBABILITY = 0.3; // ~30 % alive at startup
const BG_COLOR = "hsl(230, 15%, 10%)"; // matt dark blue-grey

// ---------------------------------------------------------------------------
//  Helpers – Game of Life Logic (pure, no side effects)
// ---------------------------------------------------------------------------

function createRandomGrid(cols: number, rows: number): GridData {
  const grid: GridData = new Array(cols * rows);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < ALIVE_PROBABILITY ? 1 : 0;
  }
  return grid;
}

function stepGrid(grid: GridData, cols: number, rows: number): GridData {
  const next: GridData = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let neighbours = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            neighbours += grid[nr * cols + nc];
          }
        }
      }
      const idx = r * cols + c;
      const alive = grid[idx];
      if (alive) {
        next[idx] = neighbours === 2 || neighbours === 3 ? 1 : 0;
      } else {
        next[idx] = neighbours === 3 ? 1 : 0;
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
//  Connected-component labelling (flood-fill) & colour voting
// ---------------------------------------------------------------------------

function labelComponents(grid: GridData, cols: number, rows: number): Int32Array {
  const labels = new Int32Array(cols * rows); // 0 = unlabelled / dead
  let currentLabel = 0;

  const stack: number[] = [];

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0 || labels[i] !== 0) continue;
    currentLabel++;
    stack.push(i);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (labels[idx] !== 0) continue;
      labels[idx] = currentLabel;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const ni = nr * cols + nc;
            if (grid[ni] === 1 && labels[ni] === 0) {
              stack.push(ni);
            }
          }
        }
      }
    }
  }

  return labels;
}

/**
 * Compute per-cell hues that are stable across iterations.
 * For each connected component we check whether ANY cell already carried a
 * base hue in the previous frame.  If yes the whole component inherits that
 * hue – this prevents flickering.  A brand-new random hue is only chosen
 * when no cell in the component had a colour before.
 */
function computeCellHues(
  grid: GridData,
  cols: number,
  rows: number,
  labels: Int32Array,
  prevCellHues: number[]
): number[] {
  const cellHues = new Array(cols * rows).fill(-1);

  // Group cells by component and find the first existing hue per component
  const componentCells = new Map<number, number[]>();
  const componentHue = new Map<number, number>();

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    const label = labels[i];
    if (!componentCells.has(label)) componentCells.set(label, []);
    componentCells.get(label)!.push(i);

    // Inherit from previous frame if available (first match wins)
    if (!componentHue.has(label) && prevCellHues[i] >= 0) {
      componentHue.set(label, prevCellHues[i]);
    }
  }

  // Assign hues – reuse existing or create new
  for (const [label, cells] of componentCells) {
    const baseHue = componentHue.has(label)
      ? componentHue.get(label)!
      : Math.floor(Math.random() * 360);
    for (const idx of cells) {
      cellHues[idx] = baseHue;
    }
  }

  return cellHues;
}

// ---------------------------------------------------------------------------
//  URL parameter helper
// ---------------------------------------------------------------------------

function getPixelsPerCell(): number {
  if (typeof window === "undefined") return DEFAULT_PIXELS_PER_CELL;
  const params = new URLSearchParams(window.location.search);
  const val = parseInt(params.get("pixels-per-cell") || "", 10);
  return val > 0 ? val : DEFAULT_PIXELS_PER_CELL;
}

// ---------------------------------------------------------------------------
//  Main Component
// ---------------------------------------------------------------------------

function GameOfLife() {
  const ctx = useContext(VirtualCtx);
  const { layout, isLeader, sharedData, engine } = ctx || {};
  const virtualEngine = engine as VirtualEngine;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsPerCell = useMemo(() => getPixelsPerCell(), []);

  // Extensions – created once per engine (leader only uses TimeManager)
  const timeManagerRef = useRef<TimeManager | null>(null);
  const eventManagerRef = useRef<EventManager | null>(null);

  useEffect(() => {
    if (!virtualEngine) return;
    timeManagerRef.current = new TimeManager(virtualEngine);
    eventManagerRef.current = new EventManager(virtualEngine);
    return () => {
      timeManagerRef.current?.destroy();
      eventManagerRef.current?.destroy();
    };
  }, [virtualEngine]);

  // ---- Cast shared data for convenience ----
  const sd = (sharedData ?? {}) as GameSharedData;

  // -----------------------------------------------------------------------
  //  1. Background colour (all windows)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!ctx?.layout) return;
    if (!sd.bgColor && isLeader && virtualEngine) {
      virtualEngine.setSharedData("bgColor", BG_COLOR);
    }
    if (sd.bgColor) {
      document.body.style.backgroundColor = sd.bgColor as string;
    }
  }, [ctx, sd.bgColor, isLeader, virtualEngine]);

  // -----------------------------------------------------------------------
  //  2. Grid initialisation (Leader only)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!ctx?.layout || !isLeader || !virtualEngine) return;
    if (sd.golGrid && sd.golGrid.length > 0) return; // already initialised

    const frameW = layout?.frame?.w ?? 1920;
    const frameH = layout?.frame?.h ?? 1080;
    const cols = Math.floor(frameW / pixelsPerCell);
    const rows = Math.floor(frameH / pixelsPerCell);

    const grid = createRandomGrid(cols, rows);
    const labels = labelComponents(grid, cols, rows);
    const emptyHues = new Array(cols * rows).fill(-1);
    const cellHues = computeCellHues(grid, cols, rows, labels, emptyHues);

    virtualEngine.setSharedData("golCols", cols);
    virtualEngine.setSharedData("golRows", rows);
    virtualEngine.setSharedData("golGrid", grid);
    virtualEngine.setSharedData("golIteration", 0);
    virtualEngine.setSharedData("golRoundStart", Date.now());
    virtualEngine.setSharedData("golCellHues", cellHues);

    // Broadcast init event via EventManager
    eventManagerRef.current?.dispatchEvent("gol_reset", { timestamp: Date.now() });

    // Set a shared timestamp via TimeManager
    timeManagerRef.current?.setTimestamp("gol_start");

    console.log(`[GoL] Initialised grid ${cols}×${rows}`);
  }, [ctx, isLeader, virtualEngine, sd.golGrid, layout, pixelsPerCell]);

  // -----------------------------------------------------------------------
  //  3. Simulation tick (Leader only – 2 iter/s)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isLeader || !virtualEngine) return;
    const cols = sd.golCols;
    const rows = sd.golRows;
    if (!cols || !rows) return;

    const handle = setInterval(() => {
      const state = virtualEngine.store.get().sharedData as GameSharedData;
      const currentGrid = state.golGrid;
      const iteration = state.golIteration ?? 0;
      const roundStart = state.golRoundStart ?? Date.now();
      if (!currentGrid) return;

      // ---- Reset after 5 minutes ----
      if (Date.now() - roundStart >= ROUND_DURATION_MS) {
        const newGrid = createRandomGrid(cols, rows);
        const labels = labelComponents(newGrid, cols, rows);
        const emptyHues = new Array(cols * rows).fill(-1);
        const cellHues = computeCellHues(newGrid, cols, rows, labels, emptyHues);
        virtualEngine.setSharedData("golGrid", newGrid);
        virtualEngine.setSharedData("golIteration", 0);
        virtualEngine.setSharedData("golRoundStart", Date.now());
        virtualEngine.setSharedData("golCellHues", cellHues);
        eventManagerRef.current?.dispatchEvent("gol_reset", { timestamp: Date.now() });
        timeManagerRef.current?.setTimestamp("gol_reset");
        console.log("[GoL] Round reset after 5 min");
        return;
      }

      // ---- Step ----
      const nextGrid = stepGrid(currentGrid, cols, rows);
      const labels = labelComponents(nextGrid, cols, rows);
      const prevHues = (state.golCellHues ?? []) as number[];
      const cellHues = computeCellHues(nextGrid, cols, rows, labels, prevHues);

      virtualEngine.setSharedData("golGrid", nextGrid);
      virtualEngine.setSharedData("golIteration", iteration + 1);
      virtualEngine.setSharedData("golCellHues", cellHues);

      // Update shared iteration timestamp
      timeManagerRef.current?.setTimestamp("gol_tick");
    }, TICK_INTERVAL_MS);

    return () => clearInterval(handle);
  }, [isLeader, virtualEngine, sd.golCols, sd.golRows]);

  // -----------------------------------------------------------------------
  //  4. Canvas rendering with fade animation (ALL windows)
  // -----------------------------------------------------------------------

  // Local-only arrays for smooth fade animation (not synced)
  const displayOpacityRef = useRef<Float32Array | null>(null);
  const lastKnownHueRef = useRef<Float32Array | null>(null);
  const prevTimeRef = useRef<number>(0);

  // Sync grid snapshot into a ref so the rAF loop can read it without deps
  const gridSnapshotRef = useRef<{
    grid: GridData | undefined;
    cellHues: number[];
    cols: number;
    rows: number;
  }>({ grid: undefined, cellHues: [], cols: 0, rows: 0 });

  useEffect(() => {
    gridSnapshotRef.current = {
      grid: sd.golGrid,
      cellHues: (sd.golCellHues ?? []) as number[],
      cols: sd.golCols ?? 0,
      rows: sd.golRows ?? 0,
    };
  }, [sd.golGrid, sd.golCellHues, sd.golCols, sd.golRows]);

  // Continuous rAF render loop – lerps opacity toward target & draws
  useEffect(() => {
    let raf: number;
    const FADE_SPEED = 4.0; // full fade in ~250 ms (fits within 500 ms tick)

    const animate = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(animate); return; }
      const dCtx = canvas.getContext("2d");
      if (!dCtx) { raf = requestAnimationFrame(animate); return; }

      const { grid, cellHues, cols, rows } = gridSnapshotRef.current;
      if (!grid || !cols || !rows) { raf = requestAnimationFrame(animate); return; }

      const len = cols * rows;

      // Lazily initialise / resize local arrays
      if (!displayOpacityRef.current || displayOpacityRef.current.length !== len) {
        displayOpacityRef.current = new Float32Array(len); // starts at 0
      }
      if (!lastKnownHueRef.current || lastKnownHueRef.current.length !== len) {
        lastKnownHueRef.current = new Float32Array(len).fill(-1);
      }

      const opacity = displayOpacityRef.current;
      const lastHue = lastKnownHueRef.current;

      // Delta-time in seconds (capped to avoid jumps on tab-switch)
      const dt = prevTimeRef.current ? Math.min((now - prevTimeRef.current) / 1000, 0.1) : 0.016;
      prevTimeRef.current = now;

      // Canvas size
      const w = cols * pixelsPerCell;
      const h = rows * pixelsPerCell;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      dCtx.clearRect(0, 0, w, h);

      const step = FADE_SPEED * dt; // how much opacity changes this frame

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const target = grid[idx]; // 0 or 1

          // Lerp opacity toward target
          if (opacity[idx] < target) {
            opacity[idx] = Math.min(opacity[idx] + step, 1);
          } else if (opacity[idx] > target) {
            opacity[idx] = Math.max(opacity[idx] - step, 0);
          }

          // Skip fully transparent cells
          if (opacity[idx] < 0.01) continue;

          // Remember hue while cell is alive so fading-out cells keep colour
          if (cellHues[idx] >= 0) {
            lastHue[idx] = cellHues[idx];
          }
          const baseHue = lastHue[idx] >= 0 ? lastHue[idx] : 180;

          // Per-cell variation (±12° hue, 45-60 % lightness)
          const hueVariation = ((idx * 7) % 25) - 12;
          const hue = (baseHue + hueVariation + 360) % 360;
          const lightness = 45 + ((idx * 3) % 15);

          dCtx.globalAlpha = opacity[idx];
          dCtx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
          dCtx.fillRect(
            c * pixelsPerCell,
            r * pixelsPerCell,
            pixelsPerCell,
            pixelsPerCell
          );
        }
      }

      dCtx.globalAlpha = 1; // reset
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [pixelsPerCell]); // stable dep – data is read from refs

  // -----------------------------------------------------------------------
  //  5. Listen for reset events (all windows, via EventManager)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!eventManagerRef.current) return;
    const handler = () => {
      console.log("[GoL] Reset event received");
    };
    eventManagerRef.current.addEventListener("gol_reset", handler);
    return () => eventManagerRef.current?.removeEventListener("gol_reset", handler);
  }, [virtualEngine]);

  // -----------------------------------------------------------------------
  //  Render
  // -----------------------------------------------------------------------
  if (!ctx || !ctx.layout) return null;

  const cols = sd.golCols ?? 0;
  const rows = sd.golRows ?? 0;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Canvas is positioned at virtual-world origin; the
          VirtualViewportProvider already applies the viewport-offset transform,
          so we just render at (0,0) in virtual-world space. */}
      <canvas
        ref={canvasRef}
        width={cols * pixelsPerCell}
        height={rows * pixelsPerCell}
        style={{ imageRendering: "pixelated" }}
      />

      {/* HUD – Iteration counter & timer (bottom-right, stays in viewport) */}
      <div
        className="fixed bottom-4 right-4 pointer-events-auto
                   rounded-lg px-4 py-2 text-xs font-mono
                   bg-black/50 text-white/80 backdrop-blur-sm
                   select-none z-50"
      >
        <span>Iteration: {sd.golIteration ?? 0}</span>
        <span className="mx-2">|</span>
        <span>
          {cols}×{rows} @ {pixelsPerCell}px
        </span>
        <span className="mx-2">|</span>
        <RemainingTime roundStart={sd.golRoundStart} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Tiny sub-component: countdown until reset
// ---------------------------------------------------------------------------

function RemainingTime({ roundStart }: { roundStart?: number }) {
  const [remaining, setRemaining] = React.useState("");

  useEffect(() => {
    const update = () => {
      if (!roundStart) {
        setRemaining("--:--");
        return;
      }
      const elapsed = Date.now() - roundStart;
      const left = Math.max(0, ROUND_DURATION_MS - elapsed);
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [roundStart]);

  return <span>Reset in {remaining}</span>;
}

// ---------------------------------------------------------------------------
//  Page export
// ---------------------------------------------------------------------------

export default function Page() {
  return (
    <main className="relative w-full h-full min-h-screen overflow-hidden">
      <GameOfLife />
    </main>
  );
}
