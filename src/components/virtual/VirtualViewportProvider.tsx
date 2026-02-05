"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Minimap } from "./Minimap";
import { PermissionDialog } from "./PermissionDialog";
import { LoadingScreen } from "./LoadingScreen";

import type { VirtualContext } from "@/lib/virtual/types/types";
import { VirtualCtx } from "@/lib/virtual/extensions/virtualContext";
import { VirtualEngine } from "@/lib/virtual/engine/VirtualEngine";
import { useVirtualState } from "@/lib/virtual/hooks/useVirtualStore";
import { getThisWindowID } from "@/lib/virtual/utils/windowId";
import { getCurrentWindowRect } from "@/lib/virtual/extensions/utils";
import { getVflFromScreenDetails } from "@/lib/virtual/utils/screenUtils";
import { normalizeLayout, encodeVflToUrlParam } from "@/lib/virtual/utils/vfl";

export function VirtualViewportProvider({ children }: { children: React.ReactNode }) {
  // 1. Initialize Engine (Client-side only)
  const [engine, setEngine] = useState<VirtualEngine | null>(null);

  // 3. Drive the Engine with physical events
  useEffect(() => {
    const newEngine = new VirtualEngine(getThisWindowID(), getCurrentWindowRect());
    setEngine(newEngine);

    const updateRect = () => {
        newEngine.updateRect(getCurrentWindowRect());
    };

    window.addEventListener("resize", updateRect);
    // Poll for position changes (browsers don't emit event for moving windows)
    const interval = setInterval(updateRect, 500);

    return () => {
        window.removeEventListener("resize", updateRect);
        clearInterval(interval);
        newEngine.dispose();
    };
  }, []);

  // 2. Sync External Store
  const state = useVirtualState(engine) || {
    // Fallback initial state for SSR
    windowId: '',
    winRect: { x:0, y:0, w:0, h:0 },
    windows: {},
    layout: null,
    viewportOffset: { x:0, y:0 },
    isLeader: false,
    leaderId: undefined,
    permissionGranted: false,
    sharedData: {},
    assignedScreenId: undefined
  };

  // 4. Request Permission Logic (Mapped to Context)
  const requestPermission = async () => {
    if (!engine) return;
    const layout = await getVflFromScreenDetails();
    if (layout) {
      const layoutParam = encodeVflToUrlParam(layout);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("layout", layoutParam);
      window.location.href = newUrl.toString();
    }
  };

  const computeWithoutPermission = () => {
    if (!engine) return;
    const layout = normalizeLayout({
      v: 1,
      screens: [
        {
          id: engine.store.get().windowId,
          x: 0,
          y: 0,
          w: window.screen.width,
          h: window.screen.height,
        },
      ],
    });

    engine.setStaticLayout(layout);
    engine.store.update((s) => {
      s.permissionGranted = true;
    });
  };

  const getVirtualBounds = () => {
    if (state.layout) {
      return state.layout.frame;
    }
    // Fallback: If initialized but no layout, return 0 size
    return { x: 0, y: 0, w: 0, h: 0 };
  };

  // 5. Construct Legacy Context Compatibility Layer
  const ctx: VirtualContext = useMemo(() => ({
    ...state,
    permissionPending: false, // simplified
    requestPermission,
    computeWithoutPermission,
    getVirtualBounds,
    engine // Expose engine for new components
  }), [state, engine]);

  // 6. Rendering
  const renderedChildren = useMemo(() => {
    if (!engine || !state.layout) return null; // Wait for layout

    const { viewportOffset } = state;
    const layout = state.layout;

    const frameW = layout.frame.w; 
    const frameH = layout.frame.h;

    // Viewport Logic 
    // This logic ensures the content stays absolute in virtual space
    // while the window acts as a viewport moving over it.
    
    // We clamp offsets slightly to avoid flickering at edges if desired, 
    // but the engine provides raw precise values.
    
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: frameW,
            height: frameH,
            transform: `translate(${-viewportOffset.x}px, ${-viewportOffset.y}px)`,
            willChange: "transform",
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
        
          <Minimap 
            layout={layout} 
            windows={state.windows} 
            windowId={state.windowId} 
            assignedScreenId={state.assignedScreenId} 
            leaderId={state.leaderId}
          />
        
      </div>
    );
  }, [state, engine, children]);

  if (!engine) return <LoadingScreen />;

  if (!state.layout) {
    return (
      <PermissionDialog
        requestPermission={requestPermission}
        computeWithoutPermission={computeWithoutPermission}
      />
    );
  }

  // Wait for Leader Election Agreement
  if (!state.leaderId) {
    return <LoadingScreen />;
  }

  return <VirtualCtx.Provider value={ctx}>{renderedChildren}</VirtualCtx.Provider>;
}
