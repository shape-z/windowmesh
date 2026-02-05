import { getThisWindowID } from "../utils/windowId";
import type { VirtualEngine } from "../engine/VirtualEngine";

type CustomEventData = { type: string; data?: unknown; timestamp: number; senderId: string };

export class EventManager {
  private engine: VirtualEngine;
  private listeners: Map<string, ((event: CustomEventData) => void)[]> = new Map();

  constructor(engine: VirtualEngine) {
    this.engine = engine;
  }

  /**
   * @brief Adds an event listener for a specific event type.
   * @param type The event type to listen for.
   * @param listener The callback function to invoke when the event occurs.
   */
  addEventListener(type: string, listener: (event: CustomEventData) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * @brief Removes an event listener for a specific event type.
   * @param type The event type.
   * @param listener The callback function to remove.
   */
  removeEventListener(type: string, listener: (event: CustomEventData) => void) {
    const list = this.listeners.get(type);
    if (list) {
      const index = list.indexOf(listener);
      if (index > -1) {
        list.splice(index, 1);
      }
    }
  }

  /**
   * @brief Dispatches a custom event to all listeners and broadcasts via VirtualEngine sharedData.
   * @param type The event type.
   * @param data Optional data associated with the event.
   */
  dispatchEvent(type: string, data?: unknown) {
    const event: CustomEventData = {
      type,
      data,
      timestamp: Date.now(),
      senderId: getThisWindowID()
    };
    // Broadcast via VirtualEngine sharedData
    this.engine.setSharedData(`event_${type}`, event);
    this.handle(event); // Auch lokal auslösen
  }

  private handle(event: CustomEventData) {
    const list = this.listeners.get(event.type);
    if (list) {
      list.forEach(listener => listener(event));
    }
  }

  destroy() {
    this.listeners.clear();
  }
}