import type { Store } from "./EngineStore";
import type { NetworkAdapter } from "./EngineNetworkAdapter";
import type { VflLayout, VirtualState } from "../types/types";
import { normalizeLayout } from "../utils/vfl";
import {
  calculateAssignedScreen,
  calculateRelativePosition,
  calculateGlobalPosition,
} from "./EnginePositioning";

// ==========================================
// Layout System
// ==========================================

export class EngineLayout {
  constructor(
    private store: Store<VirtualState>,
    private getNetwork: () => NetworkAdapter | undefined,
    private staticLayout: VflLayout | null
  ) {}

  setStaticLayout(layout: VflLayout | null) {
      this.staticLayout = layout;
      // If we got a static layout, force update immediately
      if (layout) {
          this.recalculateWorld();
      }
  }

  /**
   * @brief Leader Only: Calculates the global world layout based on all connected windows.
   */
  recalculateWorld() {
    // 1. Static Layout Override
    if (this.staticLayout) {
      this.getNetwork()?.broadcast({
        type: "LAYOUT_UPDATE",
        payload: this.staticLayout,
      });
      if (this.store.get().layout !== this.staticLayout) {
        this.store.set({ layout: this.staticLayout });
      }
      return;
    }

    // 2. Dynamic Mesh Layout logic
    const state = this.store.get();
    const allWindows = Object.values(state.windows);

    // Valid Screen = Has width/height > 0
    const screens = allWindows
      .filter((w) => w.rect && w.rect.w > 0)
      .map((w) => ({
        id: w.id,
        x: w.virtualRect?.x ?? w.rect.x,
        y: w.virtualRect?.y ?? w.rect.y,
        w: w.virtualRect?.w ?? w.rect.w,
        h: w.virtualRect?.h ?? w.rect.h,
      }));

    if (screens.length === 0) return;

    const layout = normalizeLayout({ v: 1, screens });

    this.store.set({ layout });
    this.getNetwork()?.broadcast({ type: "LAYOUT_UPDATE", payload: layout });

    this.recalculateLocalView();
  }

  /**
   * @brief Calculates which part of the global canvas this window should show.
   */
  recalculateLocalView() {
    const state = this.store.get();
    const activeLayout = this.staticLayout || state.layout;

    if (!activeLayout || activeLayout.screens.length === 0) return;

    // Step A: Find assigned screen
    const assignedScreen = calculateAssignedScreen(
      state.windowId,
      state.winRect,
      activeLayout.screens
    );

    // Step B: Calculate relative position
    const relativePos = calculateRelativePosition(
      state.winRect,
      assignedScreen
    );

    // Step C: Calculate global position
    const globalVirtualRect = calculateGlobalPosition(
      assignedScreen,
      relativePos,
      state.winRect.w,
      state.winRect.h
    );

    // Step D: Calculate Viewport Offset
    const frameX = activeLayout.frame.x;
    const frameY = activeLayout.frame.y;

    this.store.set({
      assignedScreenId: assignedScreen.id,
      viewportOffset: {
        x: globalVirtualRect.x - frameX,
        y: globalVirtualRect.y - frameY,
      },
      virtualRect: globalVirtualRect,
    });
  }
}
