import type { VirtualEvent } from "../types/types";

type MessageHandler = (event: VirtualEvent) => void;

const DEFAULT_CHANNEL = "vwin:network";

export class NetworkAdapter {
  private bc: BroadcastChannel;
  private listeners: Set<MessageHandler> = new Set();
  private windowId: string;

  constructor(windowId: string, channelName: string = DEFAULT_CHANNEL) {
    this.windowId = windowId;
    this.bc = new BroadcastChannel(channelName);
    this.bc.onmessage = this.handleMessage.bind(this);
    // console.log(`[NetworkAdapter] Connected to channel: ${channelName}`);
  }

  /**
   * @brief Broadcasts a virtual event to all connected peers in the channel.
   * @param event The event object to broadcast.
   */
  broadcast(event: VirtualEvent) {
    this.bc.postMessage(event);
  }

  /**
   * @brief Subscribes to incoming network messages.
   * @param handler logic to execute on message receipt.
   * @returns Unsubscribe function.
   */
  onMessage(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /**
   * @brief Closes the network connection and clears listeners.
   */
  close() {
    this.bc.close();
    this.listeners.clear();
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private handleMessage(ev: MessageEvent) {
    const data = ev.data as VirtualEvent;
    if (!data || !data.type) return;

    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (err) {
        console.error("[NetworkAdapter] Listener error:", err);
      }
    });
  }
}

