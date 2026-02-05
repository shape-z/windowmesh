# windowmesh

> A TypeScript / React framework for **multi-window, multi-screen** web applications.  
> Turn multiple browser tabs into viewports of a single, shared virtual canvas.

---

## Table of Contents

- [windowmesh](#windowmesh)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Key Capabilities](#key-capabilities)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Development](#development)
    - [Try It](#try-it)
  - [Architecture](#architecture)
    - [High-Level Data Flow](#high-level-data-flow)
    - [VirtualEngine](#virtualengine)
    - [Store](#store)
    - [NetworkAdapter \& BroadcastChannel](#networkadapter--broadcastchannel)
    - [Leader Election](#leader-election)
    - [Session Management](#session-management)
    - [URL Synchronisation](#url-synchronisation)
    - [Coordinate Systems](#coordinate-systems)
    - [VFL – Virtual Frame Layout](#vfl--virtual-frame-layout)
  - [React Integration](#react-integration)
    - [VirtualViewportProvider](#virtualviewportprovider)
    - [VirtualContext](#virtualcontext)
    - [Hooks](#hooks)
      - [`useVirtualState(engine)`](#usevirtualstateengine)
      - [`useVirtualStore(engine, selector)`](#usevirtualstoreengine-selector)
      - [`useVirtualMouseCoordinates()`](#usevirtualmousecoordinates)
      - [`useLayout()`](#uselayout)
      - [`useViewportOffset()`](#useviewportoffset)
  - [Extensions API](#extensions-api)
    - [EventManager](#eventmanager)
    - [TimeManager](#timemanager)
    - [InputHandler](#inputhandler)
    - [Coordinate Utilities](#coordinate-utilities)
  - [Components](#components)
    - [Minimap](#minimap)
    - [PermissionDialog](#permissiondialog)
    - [LoadingScreen](#loadingscreen)
  - [Demos](#demos)
    - [Landing Page – Animated Arrows](#landing-page--animated-arrows)
    - [Bubbles – Synchronised Particle System](#bubbles--synchronised-particle-system)
    - [Game of Life – Distributed Cellular Automaton](#game-of-life--distributed-cellular-automaton)
  - [Project Structure](#project-structure)
  - [Configuration \& Scripts](#configuration--scripts)
    - [URL Parameters](#url-parameters)
    - [Tech Stack](#tech-stack)
  - [Browser Compatibility](#browser-compatibility)
    - [BroadcastChannel](#broadcastchannel)
    - [Window Management API](#window-management-api)
    - [Screen Coordinates](#screen-coordinates)
  - [Contributing](#contributing)

---

## Overview

**windowmesh** creates a unified coordinate system that spans across multiple browser windows (tabs). When a user opens several windows of the same application, they automatically discover each other and become **viewports** into a larger **virtual canvas**. Elements render seamlessly across window boundaries, and shared state stays consistent – all without a backend server.

### Key Capabilities

| Capability | Description |
|---|---|
| **Virtual Canvas** | A single coordinate space that extends across all physical monitors. |
| **Decentralised Sync** | Peer-to-peer state replication via `BroadcastChannel` – no server required. |
| **Leader Election** | Automatic, deterministic election of a "Leader" window for heavy computation. |
| **Shared Data** | Key-value store synced across all peers in real-time (last-write-wins). |
| **URL Sync** | URL changes in one window are automatically replicated to all peers. |
| **React-first** | Provider, hooks and context for ergonomic React integration. |
| **Resilient** | Graceful cleanup on window close; automatic leader failover. |

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm**

### Installation

```bash
git clone <repo-url> && cd windowmesh
npm install
```

### Development

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm test             # Run vitest test suite
npm run build        # Production build
npm start            # Serve production build
```

### Try It

1. Open `http://localhost:3000` in your browser.
2. Open **a second tab** (or window) to the same URL.
3. Move the windows around your screen – background elements remain fixed in virtual space while the window frames move over them.
4. Close the first (Leader) window – the second window seamlessly takes over.

> **Tip:** Append `?windowmesh-minimap=true` to any URL to show the debug minimap.

---

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Tab A                       │
│                                                         │
│   React App                                             │
│     └── VirtualViewportProvider                         │
│           └── VirtualEngine                             │
│                 ├── Store<VirtualState>    (local state) │
│                 ├── EngineLayout        (positioning)    │
│                 ├── EngineNetwork       (msg handler)    │
│                 ├── EngineLifecycle     (heartbeat/LE)   │
│                 └── NetworkAdapter     (BroadcastChannel)│
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │  BroadcastChannel (session-id)
┌──────────────────────────┼───────────────────────────────┐
│                     Browser Tab B                        │
│              (same origin, same session)                 │
└──────────────────────────────────────────────────────────┘
```

All communication is **local to the browser** (same-origin, same user profile). There is no server component.

---

### VirtualEngine

`src/lib/virtual/engine/VirtualEngine.ts`

The central orchestrator. One instance per tab.

| Responsibility | Implementation |
|---|---|
| **Initialisation** | Reads `?layout=` from URL, creates the Store, instantiates sub-systems, opens the BroadcastChannel. |
| **Heartbeat loop** | Every 1 s → publishes own window state, runs leader election, requests layout if needed. |
| **Cleanup loop** | Every 5 s → removes peers that haven't sent a heartbeat for > 5 s. |
| **Shared data** | `setSharedData(key, value)` → updates local store **and** broadcasts to all peers. |
| **URL sync** | Monkey-patches `history.pushState` / `replaceState` and listens for `popstate` to broadcast URL changes. |
| **Disposal** | Stops timers, sends `GOODBYE`, closes the BroadcastChannel, restores `history` methods. |

**Public API:**

```ts
class VirtualEngine {
  store: Store<VirtualState>;

  updateRect(rect: Rect): void;              // Call on window move/resize
  setStaticLayout(layout: VflLayout | null): void;
  setSharedData(key: string, value: unknown): void;
  dispose(): void;
}
```

---

### Store

`src/lib/virtual/engine/EngineStore.ts`

A lightweight, synchronous, reactive state container (similar to Zustand).

```ts
class Store<T extends object> {
  get(): T;                                        // Current snapshot
  set(partial: Partial<T> | (prev: T) => T): void; // Shallow merge + notify
  update(mutator: (draft: T) => void): void;       // Mutable-draft pattern
  subscribe(listener: (state: T) => void): () => void;
}
```

The `VirtualState` shape managed by the store:

| Field | Type | Description |
|---|---|---|
| `windowId` | `string` | Unique ID of this window (regenerated on every page load). |
| `winRect` | `Rect` | Physical browser window position and size. |
| `windows` | `Record<string, WindowSnapshot>` | Registry of all known peers. |
| `layout` | `VflLayout \| null` | Current virtual layout (frame + screens). |
| `assignedScreenId` | `string \| undefined` | Which virtual screen this window maps to. |
| `viewportOffset` | `{ x, y }` | Offset into the virtual canvas. |
| `virtualRect` | `Rect \| undefined` | Global virtual coordinates of this window. |
| `isLeader` | `boolean` | Whether this window is the current leader. |
| `leaderId` | `string \| undefined` | Window ID of the current leader. |
| `permissionGranted` | `boolean` | Whether screen-management permission was granted. |
| `sharedData` | `Record<string, unknown>` | Application-specific synced key-value data. |

---

### NetworkAdapter & BroadcastChannel

`src/lib/virtual/engine/EngineNetworkAdapter.ts`

Thin wrapper around the browser's [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

```ts
class NetworkAdapter {
  constructor(windowId: string, channelName: string);
  broadcast(event: VirtualEvent): void;
  onMessage(handler: (event: VirtualEvent) => void): () => void;
  close(): void;
}
```

**Message types** (`VirtualEvent` union):

| Type | Payload | Direction |
|---|---|---|
| `HELLO` | `WindowSnapshot` | Peer → All |
| `HEARTBEAT` | `WindowSnapshot` | Peer → All (every 1 s) |
| `GOODBYE` | `{ id }` | Closing peer → All |
| `LAYOUT_UPDATE` | `VflLayout` | Leader → All |
| `LEADER_CLAIM` | `{ id, timestamp }` | New leader → All |
| `SHARED_DATA_UPDATE` | `{ key, value }` | Any → All |
| `REQUEST_LAYOUT` | `{ id }` | New peer → Leader |
| `URL_SYNC` | `{ senderId, url }` | Any → All |

---

### Leader Election

`src/lib/virtual/engine/EngineLeaderElection.ts`

**Algorithm:** Deterministic – the **oldest active window** (by `createdAt` timestamp) becomes leader. Ties are broken alphabetically by window ID.

| Step | Detail |
|---|---|
| **Candidacy** | All windows with a heartbeat within the last 5 s are eligible. |
| **Sort** | Candidates sorted by `createdAt` ascending, then by `id` ascending. |
| **Election** | First candidate wins. Runs every heartbeat tick (1 s). |
| **Grace period** | First 3 ticks after engine start are skipped to allow peer discovery. |
| **Failover** | When the leader closes or times out, the next candidate is elected automatically on the next tick. |

```ts
function sortCandidates(windows: WindowSnapshot[]): WindowSnapshot[];
function electLeader(
  windows: Record<string, WindowSnapshot>,
  selfId: string,
  selfCreatedAt: number
): string | null;
```

---

### Session Management

`src/lib/virtual/engine/EngineSessionUtils.ts`

Windows that share the **same `?layout=` URL parameter** automatically land in the **same session** (same BroadcastChannel).

```
URL: https://example.com/demo?layout=vfl1.0_0_1920_1080.0_0_1920_1080
                                        ↓
                              hash("vfl1.0_0_…") → "vwin:a1b2c3"
                                        ↓
                         BroadcastChannel("vwin:a1b2c3")
```

If no `layout` parameter is present, the channel name defaults to `"default"`.

---

### URL Synchronisation

When a window's URL changes (via `pushState`, `replaceState`, or browser back/forward), the change is broadcast to all peers in the session as a `URL_SYNC` event.

**Key behaviours:**

- The `layout` query parameter is **always preserved per-window** – it is device-specific and never overwritten by sync.
- Incoming URL changes are applied via `replaceState` to avoid polluting the browser history.
- A global suppress flag (`__vwin_suppress_url_broadcast`) prevents echo loops.
- A `__vwin_url_sync` CustomEvent is dispatched on `window` so React components can react to URL changes from peers.

---

### Coordinate Systems

`src/lib/virtual/extensions/coordinates.ts`

Three coordinate systems are used:

```
Screen Coordinates (physical monitor)
   │
   ├─ window.screenX / screenY
   ▼
Window Coordinates (browser viewport)
   │
   ├─ + viewportOffset
   ▼
Virtual / Global Coordinates (shared canvas)
```

| Function | Conversion |
|---|---|
| `localToGlobal(x, y, offset)` | Window → Virtual |
| `globalToLocal(x, y, offset)` | Virtual → Window |
| `windowToGlobal(x, y, offset)` | Screen → Virtual |
| `globalToWindow(x, y, offset)` | Virtual → Screen |
| `useVirtualMouseCoordinates()` | Hook: current mouse position in virtual space |

---

### VFL – Virtual Frame Layout

`src/lib/virtual/utils/vfl.ts`

The **Virtual Frame Layout** describes the abstract canvas and the physical screens mapped onto it.

```ts
type VflLayout = {
  v: 1;                    // Schema version
  frame: Rect;             // Bounding box of the entire canvas
  screens: VflScreen[];    // Physical screens with position + size
};
```

**Serialisation format:** `vfl1.<frame>.<screen1>.<screen2>.…`  
Each rect is encoded as `x_y_w_h`.

| Function | Description |
|---|---|
| `normalizeLayout(partial)` | Validates with Zod, computes bounding frame. |
| `encodeVflToUrlParam(layout)` | `VflLayout` → URL-safe string. |
| `decodeVflFromUrlParam(str)` | String → `VflLayout`. |
| `assignWindowToScreen(…)` | Maps a window to the best-matching screen by dimension similarity. |
| `intersect(a, b)` | Rectangle intersection (or `null`). |

---

## React Integration

### VirtualViewportProvider

`src/components/virtual/VirtualViewportProvider.tsx`

The top-level provider that boots the engine and exposes context to the entire tree.

```tsx
import { VirtualViewportProvider } from "@/components/virtual/VirtualViewportProvider";

export default function Layout({ children }) {
  return <VirtualViewportProvider>{children}</VirtualViewportProvider>;
}
```

**Lifecycle:**

1. Creates a `VirtualEngine` on mount (client-side only).
2. Polls `window.screenX/Y` every 500 ms to detect window movement.
3. Exposes state via `VirtualCtx` React Context.
4. Renders `<PermissionDialog>` if no layout is available.
5. Renders `<LoadingScreen>` until leader election completes.
6. Applies the viewport transform: children are rendered in a container offset by `-viewportOffset`.

---

### VirtualContext

`src/lib/virtual/extensions/virtualContext.ts`

```ts
type VirtualContext = VirtualState & {
  requestPermission: () => Promise<void>;
  computeWithoutPermission: () => void;
  getVirtualBounds: () => Rect;
  engine: VirtualEngine | null;
};

const VirtualCtx: React.Context<VirtualContext | null>;
```

Access in any child component:

```tsx
const ctx = useContext(VirtualCtx);
const { isLeader, sharedData, engine, layout } = ctx;
```

---

### Hooks

#### `useVirtualState(engine)`

`src/lib/virtual/hooks/useVirtualStore.ts`

Returns the full `VirtualState` reactively (re-renders on any state change).

```ts
const state = useVirtualState(engine);
```

#### `useVirtualStore(engine, selector)`

Same file. Returns a **selected slice** of state – only re-renders when that slice changes.

```ts
const isLeader = useVirtualStore(engine, (s) => s.isLeader);
const particles = useVirtualStore(engine, (s) => s.sharedData.particles);
```

#### `useVirtualMouseCoordinates()`

`src/lib/virtual/extensions/coordinates.ts`

Returns the current mouse position in **global virtual coordinates** (`{ x, y } | null`).

```ts
const mousePos = useVirtualMouseCoordinates();
```

#### `useLayout()`

`src/lib/virtual/hooks/useLayout.ts`

Manages layout loading from URL and permission flows. Returns `{ layout, needsPermission, requestPermission, computeWithoutPermission }`.

#### `useViewportOffset()`

`src/lib/virtual/hooks/useViewportOffset.ts`

Computes `viewportOffset`, screen assignment and `virtualRect` for the current window.

---

## Extensions API

Built on top of the engine, these provide higher-level functionality for application developers.

### EventManager

`src/lib/virtual/extensions/eventManager.ts`

A typed pub/sub event bus that works **both locally and across peers**.

```ts
const events = new EventManager(engine);

// Subscribe
events.addEventListener("game_over", (data) => {
  console.log("Game ended!", data);
});

// Publish (broadcasts to all peers automatically)
events.dispatchEvent("game_over", { score: 42 });

// Cleanup
events.destroy();
```

Events are transported as `SHARED_DATA_UPDATE` messages with a reserved key prefix.

---

### TimeManager

`src/lib/virtual/extensions/timeManager.ts`

Shared timers and timestamps, synchronised across peers.

```ts
const time = new TimeManager(engine);

// Named timestamp (epoch ms)
time.setTimestamp("round_start");
const ts = time.getTimestamp("round_start"); // number | undefined

// Repeating timer
time.startTimer("countdown", 1000); // fires every 1 s across all peers
time.stopTimer("countdown");

// Read elapsed
const elapsed = time.getElapsed("countdown"); // ms since start

time.destroy();
```

---

### InputHandler

`src/lib/virtual/extensions/inputHandler.ts`

A React hook that captures all DOM input events, converts mouse coordinates to virtual space, and broadcasts them to peers.

```ts
const inputEvents = useInputHandler(engine);
// inputEvents: InputEvent[] (keyboard, mouse, scroll, wheel)
```

Captured events: `keydown`, `keyup`, `mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave`, `wheel`, `scroll`.

---

### Coordinate Utilities

See [Coordinate Systems](#coordinate-systems) above.

---

## Components

### Minimap

`src/components/virtual/Minimap.tsx`

Debug overlay (bottom-right corner) that visualises all screens and connected windows in the virtual layout.

- **Enabled via URL:** `?windowmesh-minimap=true`
- Current window highlighted in **yellow**, others in **green**.
- Leader marked with 👑.
- Own screen highlighted in **purple**.

```tsx
<Minimap
  layout={state.layout}
  windows={state.windows}
  windowId={state.windowId}
  assignedScreenId={state.assignedScreenId}
  leaderId={state.leaderId}
/>
```

### PermissionDialog

`src/components/virtual/PermissionDialog.tsx`

Shown when no layout is available. Offers two options:

1. **Grant permission** – Uses the [Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) to scan all monitors and build a `VflLayout`.
2. **Continue without permission** – Creates a single-screen layout from `window.screen` dimensions.

### LoadingScreen

`src/components/virtual/LoadingScreen.tsx`

Full-screen loading spinner shown during engine initialisation and leader election.

---

## Demos

### Landing Page – Animated Arrows

**Route:** `/`

Decorative animated arrows orbiting a central point in the virtual canvas. Demonstrates basic virtual-context usage and coordinate-aware rendering.

### Bubbles – Synchronised Particle System

**Route:** `/demos/bubbles`

~22 particles + 4 large background orbs with orbital motion. The **Leader** runs the physics simulation and syncs particle data via `sharedData`. All windows render the particles at time-synchronised positions using `Date.now()` for frame interpolation – no React re-renders, direct DOM manipulation for performance.

### Game of Life – Distributed Cellular Automaton

**Route:** `/demos/game-of-life`

Conway's Game of Life on a grid that spans the entire virtual canvas.

| Aspect | Detail |
|---|---|
| **Grid size** | `frame.w / pixelsPerCell` × `frame.h / pixelsPerCell` (configurable via `?pixels-per-cell=N`). |
| **Tick rate** | 2 iterations / second (500 ms). |
| **Round duration** | 5 minutes, then auto-reset with a new random grid. |
| **Colouring** | Connected components share a hue; hues persist across iterations via flood-fill labelling. |
| **Rendering** | `requestAnimationFrame` loop with smooth fade-in/out (opacity lerp at 4×/s). |
| **Extensions used** | `EventManager` (reset events), `TimeManager` (shared timestamps). |

---

## Project Structure

```
windowmesh/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # Root layout (VirtualViewportProvider)
│   │   ├── page.tsx                   # Landing page (animated arrows)
│   │   └── demos/
│   │       ├── bubbles/page.tsx       # Particle system demo
│   │       └── game-of-life/page.tsx  # Game of Life demo
│   │
│   ├── components/virtual/            # React UI Components
│   │   ├── VirtualViewportProvider.tsx # Engine bootstrap + context provider
│   │   ├── Minimap.tsx                # Debug overlay
│   │   ├── PermissionDialog.tsx       # Screen permission flow
│   │   └── LoadingScreen.tsx          # Loading spinner
│   │
│   └── lib/virtual/                   # Core Library
│       ├── engine/                    # Internal engine modules
│       │   ├── VirtualEngine.ts       # Main orchestrator
│       │   ├── EngineStore.ts         # Reactive state container
│       │   ├── EngineNetwork.ts       # Message handling logic
│       │   ├── EngineNetworkAdapter.ts# BroadcastChannel wrapper
│       │   ├── EngineLayout.ts        # Layout calculation & distribution
│       │   ├── EngineLeaderElection.ts# Leader election algorithm
│       │   ├── EngineLifecycle.ts     # Heartbeat & cleanup loops
│       │   ├── EnginePositioning.ts   # Screen assignment & positioning
│       │   └── EngineSessionUtils.ts  # Session ID generation
│       │
│       ├── extensions/                # Public API for app developers
│       │   ├── index.ts               # Barrel exports
│       │   ├── virtualContext.ts      # React context definition
│       │   ├── coordinates.ts         # Coordinate conversion + hooks
│       │   ├── eventManager.ts        # Cross-window event bus
│       │   ├── timeManager.ts         # Shared timers & timestamps
│       │   ├── inputHandler.ts        # Input capture & broadcast
│       │   └── utils.ts               # Helpers (once, debounce, throttle)
│       │
│       ├── hooks/                     # React hooks
│       │   ├── useVirtualStore.ts     # Primary state hook
│       │   ├── useLayout.ts           # Layout loading hook
│       │   └── useViewportOffset.ts   # Viewport calculation hook
│       │
│       ├── types/
│       │   └── types.ts               # All TypeScript type definitions
│       │
│       ├── utils/                     # Pure utility functions
│       │   ├── vfl.ts                 # VFL encoding/decoding/validation
│       │   ├── screenUtils.ts         # Screen Details API helpers
│       │   ├── windowId.ts            # Window ID generation (nanoid)
│       │   └── windowStateUtils.ts    # Screen assignment & positioning
│       │
│       └── __tests__/                 # Test suite (vitest)
│           ├── VirtualEngine.test.ts
│           ├── Store.test.ts
│           ├── NetworkAdapter.test.ts
│           ├── coordinates.test.ts
│           ├── eventManager.test.ts
│           ├── inputHandler.test.ts
│           ├── timeManager.test.ts
│           ├── vfl.test.ts
│           ├── pipeline.test.ts
│           ├── positioning.test.ts
│           ├── sessionUtils.test.ts
│           ├── StartupScenarios.test.ts
│           ├── urlParsing.test.ts
│           ├── useVirtualStore.test.ts
│           └── windowStateUtils.test.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.ts
├── eslint.config.mjs
└── postcss.config.mjs
```

---

## Configuration & Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start Next.js development server. |
| `build` | `npm run build` | Production build. |
| `start` | `npm start` | Serve production build. |
| `test` | `npm test` | Run vitest test suite. |
| `lint` | `npm run lint` | Run ESLint. |
| `check:deps` | `npm run check:deps` | Find unused dependencies. |

### URL Parameters

| Parameter | Example | Description |
|---|---|---|
| `layout` | `vfl1.0_0_3840_1080.0_0_1920_1080.1920_0_1920_1080` | VFL-encoded multi-screen layout. Determines session membership. |
| `windowmesh-minimap` | `true` | Show the debug minimap overlay. |
| `pixels-per-cell` | `10` | Game of Life: cell size in pixels. |
| `screenPosition` | `0_0` | Override window-to-screen position mapping. |

### Tech Stack

| Technology | Usage |
|---|---|
| **Next.js 16** | App Router, React Server Components, development server. |
| **React 19** | UI rendering, hooks, context. |
| **TypeScript 5** | Type safety throughout. |
| **Tailwind CSS 4** | Styling (utility-first). |
| **Zod 4** | VFL schema validation. |
| **nanoid** | Window ID generation. |
| **Vitest** | Unit testing framework. |
| **happy-dom** | Test environment (DOM simulation). |

---

## Browser Compatibility

### BroadcastChannel

The core communication primitive. Supported in all modern browsers. Requires **same-origin** (protocol + domain + port) and same browser profile.

### Window Management API

Used by the `PermissionDialog` to detect multi-monitor layouts.

| Browser | Support |
|---|---|
| **Chrome / Edge** | ✅ Full support. Requires user permission prompt. |
| **Firefox** | ⚠️ Limited – `window.getScreenDetails()` not available. Use URL-based layout. |
| **Safari** | ❌ Not supported. Use "Continue without permission" or pass `?layout=` manually. |

### Screen Coordinates

`window.screenX` / `window.screenY` accuracy varies:

- **Chrome / Edge:** Generally accurate.
- **Safari:** May report restricted values due to privacy protections. A static layout via URL is recommended.

---

## Contributing

windowmesh is a proof of concept for distributed browser state management. Contributions are welcome:

- **WebRTC adapter** – Replace or supplement `BroadcastChannel` for cross-browser-profile / cross-device communication.
- **Layout algorithms** – Extend `EnginePositioning.ts` with smarter screen-assignment heuristics.
- **New demos** – Build interactive multi-window experiences on top of the extensions API.
- **Conflict resolution** – Replace last-write-wins with CRDTs for `sharedData`.

```bash
# Run tests before submitting
npm test
```
