import type { Store } from "./EngineStore";
import type { VirtualState, WindowSnapshot, VflLayout } from "../types/types";
import { selectLeader } from "./EngineLeaderElection";
import type { EngineLayout } from "./EngineLayout";
import type { EngineNetwork } from "./EngineNetwork";

const WINDOW_TIMEOUT = 5000;
const STARTUP_GRACE_PERIOD_TICKS = 3;

// ==========================================
// Lifecycle System (Heartbeat & Cleanup)
// ==========================================

export class EngineLifecycle {
  private ticksSinceStart = 0;

  constructor(
    private store: Store<VirtualState>,
    private layoutSystem: EngineLayout,
    private networkSystem: EngineNetwork,
    private getIdentity: () => { windowId: string; createdAt: number },
    private staticLayout: VflLayout | null
  ) {}

  /**
   * @brief The "Game Loop" of the engine.
   */
  tick() {
    // A. Always publish existence first
    this.networkSystem.publishSelf();

    const state = this.store.get();
    const now = Date.now();
    const allWindows = Object.values(state.windows);

    // B. Warm-Up Phase
    if (this.ticksSinceStart < STARTUP_GRACE_PERIOD_TICKS) {
      this.ticksSinceStart++;
      return;
    }

    // C. Leader Election Logic
    const { windowId, createdAt } = this.getIdentity();
    const me: WindowSnapshot = {
      id: windowId,
      createdAt: createdAt,
      lastSeen: now,
      rect: state.winRect,
      timestamp: now,
    };

    const { isMe, leaderId } = selectLeader(allWindows, me, WINDOW_TIMEOUT);

    // Sync leaderId to store for UI visibility checks
    if (state.leaderId !== leaderId) {
        this.store.set({ leaderId });
    }

    // Poll for data if we are missing it and not leader
    if (!state.isLeader && !state.layout) {
        this.networkSystem.requestData();
    }

    // D. Apply Leader/Follower State changes
    if (isMe) {
      if (!state.isLeader) {
        console.log(`[VirtualEngine] Taking Leadership.`);
        this.store.set({ isLeader: true });
        this.layoutSystem.recalculateWorld();
      }
    } else {
      if (state.isLeader) {
        console.log(`[VirtualEngine] Stepping down. New Leader is ${leaderId}`);
        this.store.set({ isLeader: false });
      }
    }
  }

  /**
   * @brief Removes windows that have timed out.
   */
  cleanupFn() {
    const state = this.store.get();
    const now = Date.now();
    let changed = false;
    const nextWindows = { ...state.windows };
    const { windowId } = this.getIdentity();

    Object.keys(nextWindows).forEach((key) => {
      if (key === windowId) return; // Don't kill ourselves

      if (now - nextWindows[key].lastSeen > WINDOW_TIMEOUT) {
        delete nextWindows[key];
        changed = true;
      }
    });

    if (changed) {
      this.store.set({ windows: nextWindows });
      if (state.isLeader && !this.staticLayout) {
        this.layoutSystem.recalculateWorld();
      }
    }
  }
}
