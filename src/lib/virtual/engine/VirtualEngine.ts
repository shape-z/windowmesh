import { NetworkAdapter } from "./EngineNetworkAdapter";
import { Store } from "./EngineStore";
import type { VirtualState, Rect, VflLayout } from "../types/types";
import { generateSessionId } from "./EngineSessionUtils";
import { getStaticLayoutFromUrl } from "./EnginePositioning";
import { EngineLayout } from "./EngineLayout";
import { EngineNetwork } from "./EngineNetwork";
import { EngineLifecycle } from "./EngineLifecycle";

const HEARTBEAT_INTERVAL = 1000;
const CLEANUP_INTERVAL = 5000;

export class VirtualEngine {
  store: Store<VirtualState>;
  private network: NetworkAdapter | undefined; // Make explicit undefined

  // Systems
  private layoutSystem: EngineLayout;
  private networkSystem: EngineNetwork;
  private lifecycleSystem: EngineLifecycle;

  // Timers
  private heartbeatTimer: number | null = null;
  private cleanupTimer: number | null = null;

  // Identity
  private createdAt: number = Date.now();
  private sessionId: string = "default";
  
  // Config
  private staticLayout: VflLayout | null = null;

  constructor(windowId: string, initialRect: Rect) {
    this.staticLayout = getStaticLayoutFromUrl();

    // Initialize Local State Store
    const initialState: VirtualState = {
      windowId,
      winRect: initialRect,
      windows: {}, 
      layout: this.staticLayout || null,
      assignedScreenId: undefined,
      viewportOffset: { x: 0, y: 0 },
      isLeader: false,
      leaderId: undefined,
      permissionGranted: false,
      sharedData: {},
    };
    this.store = new Store(initialState);

    // Initialize Systems
    // Helper to allow systems to access network even if initialized later
    const getNetwork = () => this.network;
    const getIdentity = () => ({ windowId, createdAt: this.createdAt });

    this.layoutSystem = new EngineLayout(this.store, getNetwork, this.staticLayout);
    
    this.networkSystem = new EngineNetwork(
        this.store, 
        this.layoutSystem, 
        getNetwork, 
        getIdentity
    );

    this.lifecycleSystem = new EngineLifecycle(
        this.store,
        this.layoutSystem,
        this.networkSystem,
        getIdentity,
        this.staticLayout
    );

    // Start Async Init
     // Attempt to read layout string from URL for session hashing
    const layoutStr =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("layout") || ""
        : "";
        
    this.initializeNetwork(windowId, layoutStr);
  }

  private async initializeNetwork(windowId: string, layoutStr: string) {
    this.sessionId = await generateSessionId(layoutStr);
    console.log(`[VirtualEngine] Session ID: ${this.sessionId}`);

    this.network = new NetworkAdapter(windowId, this.sessionId);
    
    // Connect Network System listener
    this.network.onMessage((msg) => this.networkSystem.handleMessage(msg));

    // Immediate Announce & Request
    this.network.broadcast({ 
        type: "REQUEST_LAYOUT", 
        payload: { id: windowId } 
    });
    this.networkSystem.publishSelf();
    // Start Loops via Lifecycle System
    this.heartbeatTimer = setInterval(
      () => this.lifecycleSystem.tick(),
      HEARTBEAT_INTERVAL
    ) as unknown as number;

    this.cleanupTimer = setInterval(
      () => this.lifecycleSystem.cleanupFn(),
      CLEANUP_INTERVAL
    ) as unknown as number;

    // Initial View Calculation
    if (this.staticLayout) {
      this.layoutSystem.recalculateLocalView();
    }

    this.networkSystem.publishSelf();
    console.log(`[VirtualEngine] Started ${windowId} in session ${this.sessionId}`);
  }

  /**
   * @brief Called whenever the physical browser window moves or resizes.
   * @param rect New window rectangle.
   */
  updateRect(rect: Rect) {
    this.store.set((prev) => ({ ...prev, winRect: rect }));
    
    // Re-calc my position immediately
    this.layoutSystem.recalculateLocalView();
    this.networkSystem.publishSelf();

    // If Leader, recalculate world
    if (this.store.get().isLeader && !this.staticLayout) {
      this.layoutSystem.recalculateWorld();
    }
  }

  /**
   * @brief Sets a static layout manually (e.g. from permission dialog).
   */
  setStaticLayout(layout: VflLayout | null) {
      this.staticLayout = layout;
      this.layoutSystem.setStaticLayout(layout);
      this.layoutSystem.recalculateLocalView();
      
      // Update store directly so UI reacts immediately
      if (layout) {
          this.store.update(s => ({ layout }));
      }
  }

  /**
   * @brief Updates a shared key-value pair and broadcasts it to all peers.
   * @param key The data key.
   * @param value The value to store.
   */
  setSharedData(key: string, value: unknown) {
    this.store.update((s) => {
      s.sharedData[key] = value;
    });
    this.network?.broadcast({
      type: "SHARED_DATA_UPDATE",
      payload: { key, value },
    });
  }

  /**
   * @brief Disposes the engine and stops all timers.
   */
  dispose() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.network) {
      try {
        this.network.broadcast({
          type: "GOODBYE",
          payload: { id: this.store.get().windowId },
        });
        this.network.close();
      } catch (e) {
        // Ignore network errors during dispose (e.g. channel already closed)
        console.warn("[VirtualEngine] Dispose warning:", e);
      }
      this.network = undefined;
    }
  }
}
