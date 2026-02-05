# windowmesh

## Overview

**windowmesh** is a TypeScript library and React framework designed to create "Virtual Viewport" experiences found in multi-window on multi-screen web applications. It allows you to orchestrate multiple browser windows (tabs) to act as a single, unified display surface.

When you open multiple windows of the application, they become "viewports" into a larger shared virtual space. Elements can move seamlessly from one window to another, and the background environment (the "World") remains consistent regardless of how the physical windows are arranged on your user's monitor.

## 🚀 Features

*   **Virtual Space Management:** Creates a unified coordinate system that spans uniformly across multiple browser windows.
*   **Decentralized State Sync:** Uses a custom `Store` and `NetworkAdapter` to synchronize state (like window positions and application data) across tabs without a backend server.
*   **Leader Election:** Automatically elects a "Leader" window to handle heavy computations (physics, game logic) and replicate the state to "Follower" windows.
*   **React Integration:** Provides a `VirtualViewportProvider` and hooks like `useVirtualStore` to easily access shared state in your React components.
*   **Resiliency:** Handles window closing (cleanup) and leader failure (automatic re-election) gracefully.

---

## 🏗 Architecture & Core Concepts

### 1. The Virtual Engine
At the heart of the library is the `VirtualEngine`. It is a singleton class responsible for:
*   **Lifecycle Management:** Tracking the existence of the current window and its peers.
*   **Heartbeat Loop:** Sending strictly timed "I am alive" signals to other windows.
*   **Mesh Network:** Utilizing the `NetworkAdapter` to broadcast state changes to all connected clients.

### 2. Leader Election
To prevent race conditions and double-calculations (e.g., two windows trying to move the same physics object), the library implements a **Leader Election** algorithm.
*   **Criteria:** The "oldest" window (by creation timestamp) is usually elected as the Leader.
*   **Role:** The Leader is responsible for "World Physics" (e.g., calculating particle positions) and writing to the `sharedData` store.
*   **Failover:** If the Leader closes, the next oldest window automatically takes over within seconds.

### 3. Coordinate Systems
The library manages two coordinate systems:
*   **Global Layout (The VFL):** A defined virtual space (e.g., 1920x1080) that exists abstractly.
*   **Window Viewport:** The specific slice of that virtual space that a physical browser window is currently finding.
*   **Offset Calculation:** The engine continuously calculates the absolute screen position of the browser window (`window.screenX`, `window.screenY`) to determine which part of the virtual background to render.

### 4. The Store
A lightweight, event-driven state container (`EngineStore.ts`) is used instead of heavy external libraries. It manages:
*   `windows`: A map of all active peers.
*   `layout`: The total dimensions of the virtual world.
*   `sharedData`: A generic dictionary for application-specific data (synced across all windows).

---

## 📂 Project Structure

```
src/
├── app/                  # Next.js App Router (The Demo)
│   ├── page.tsx          # Main entry point & Particle Demo
│   └── layout.tsx        # Global layout wrapper
├── components/
│   └── virtual/          # React Integration Components
│       ├── VirtualViewportProvider.tsx  # Context Provider for the Engine
│       └── Minimap.tsx                  # Visualization of connected windows
├── lib/
│   └── virtual/          # Core Library Logic
│       ├── engine/               # Internal Engine Logic
│       │   ├── VirtualEngine.ts       # Main logic controller
│       │   ├── EngineStore.ts         # State management
│       │   ├── EngineNetworkAdapter.ts # P2P Communication
│       │   └── EngineLeaderElection.ts # Consensus algorithm
│       ├── extensions/           # Public API & Helpers
│       │   ├── coordinates.ts    # Coordinate systems (Global <-> Local)
│       │   ├── eventManager.ts   # Custom event bus
│       │   └── virtualContext.ts # React Context
│       ├── hooks/                # React Hooks
│       │   └── useVirtualStore.ts # Primary State Hook
       └── types/                # TypeScript definitions
```

---

## 🔌 Client API & Extensions

The `extensions` feature acts as the public API for developers building on top of **windowmesh**. Instead of dealing with the raw Engine, you should use these hooks and utilities to build your distributed application.

### 1. Accessing State (`useVirtualStore`)
The primary way to access the distributed state is via the `useVirtualStore` hook. This ensures your component only re-renders when the specific slice of state changes.

```tsx
import { useVirtualStore } from "@/lib/virtual/hooks/useVirtualStore";

// Example: Get only the leader status
const isLeader = useVirtualStore(engine, (state) => state.isLeader);

// Example: Get the shared data object
const sharedData = useVirtualStore(engine, (state) => state.sharedData);
```

### 2. Coordinate Utilities (`extensions/coordinates.ts`)
In this environment, "Screen Coordinates" (where an element is in your DOM) are different from "Global Coordinates" (where an element is in the virtual world).

*   **`useVirtualMouseCoordinates()`**: A hook that returns the mouse position `{x, y}` relative to the **Virtual World**, automatically compensating for the window's position on screen.
*   **`localToGlobal(x, y, offset)`**: Converts a point in the local DOM to the Global World.
*   **`globalToLocal(x, y, offset)`**: Converts a Global World point to a local DOM position (useful for rendering).

### 3. Visual Components
#### `<Minimap />`
The library includes a `<Minimap />` component to debug or visualize the swarm of windows.

**Usage:**
```tsx
import { Minimap } from "@/components/virtual/Minimap";

// In your root component
<Minimap 
  layout={state.layout} 
  windows={state.windows} 
  windowId={state.windowId} 
/>
```

### 4. Creating a Custom "Virtual" Component
To build your own synchronized element (like a floating scoreboard or a player avatar), follow this pattern:

```tsx
const Virtualcomponent = () => {
    // 1. Get Context
    const { engine, isLeader, sharedData } = useContext(VirtualCtx);
    
    // 2. Read synced data
    const position = sharedData.myObjectPosition; // { x: 100, y: 100 }
    
    // 3. Convert to Local Coordinates for rendering
    // (If the object is at 100,100 but my window is at 500,000, it should be off-screen)
    const localPos = globalToLocal(position.x, position.y, engine.store.get().viewportOffset);

    return (
        <div style={{
            position: 'absolute',
            left: localPos.x,
            top: localPos.y
        }}>
           I am a synchronized object!
        </div>
    );
};
```

---

## 🧩 The Demo (App)

The included `src/app` demonstrates the capabilities of the library using a **Synchronized Particle System**.

### How the Demo works (`page.tsx`)
1.  **Initialization:** The `VirtualViewportProvider` initializes the engine.
2.  **Leader Role:** Only the Leader window runs the physics loop inside the `useEffect`. It calculates the position of floating orbs/particles.
3.  **Data Sync:** The Leader writes these positions to `sharedData.particles`.
4.  **Rendering:**
    *   All windows (Leader and Followers) read from `sharedData.particles`.
    *   They render the particles **relative** to their own window's viewport offset.
    *   This creates the illusion that the particles are floating in a continuous space behind the windows.
5.  **Dynamic Colors:** The specific background color is generated by the Leader and synced to all windows ensuring a uniform look.

---

## 🛠 Usage & Installation

### Prerequisites
*   Node.js 18+
*   npm

### Setup
1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

### Running Tests
To run the test suite:
```bash
npm test
```

3.  **Test the Virtual Window:**
    *   Open `http://localhost:3000` in your browser.
    *   **Open a second window** (or tab) to the same URL.
    *   Move the windows around your screen. You will see the background elements stay "fixed" in space relative to your monitor, while the window frame moves over them.
    *   Close the "Leader" (the first window) and watch the second window take over the physics calculation seamlessly.

---

## ⚠️ Browser Compatibility & Limitations

### Window Placement & Coordinates
Modern browsers have varying levels of security restrictions regarding reading a window's absolute screen coordinates and managing multi-screen layouts.

*   **Chrome / Edge (Chromium):** Generally works best. However, accurate layout calculation and multi-screen management (via the **Window Management API**) often require the user to **confirm a permission prompt** ("Allow this site to manage your windows?").
*   **Safari:** Apple's browser has stricter privacy protections regarding window coordinates (`screenX`/`screenY`). Automatic layout detection often fails or is blocked. Therefore, **you must explicitly pass the layout** (e.g., via URL parameters) or ensure the layout is statically defined, as Safari will not reliably report screen positioning relative to the global space.
engine/EngineP
---

## 🤝 Contributing

This project is a Proof of Concept for distributed browser state management. 
Feel free to extend the `VirtualEngine` with WebRTC support for lower latency or add more complex layout algorithms in `src/lib/virtual/engine/EnginePositioning.ts`.
