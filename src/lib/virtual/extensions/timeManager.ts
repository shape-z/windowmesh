import type { VirtualEngine } from "../engine/VirtualEngine";

type TimeEvent =
  | { t: "timer_start"; id: string; duration: number; timestamp: number }
  | { t: "timer_end"; id: string; timestamp: number }
  | { t: "timestamp_update"; key: string; value: number };

export class TimeManager {
  private engine: VirtualEngine;
  private timers: Map<string, { start: number; duration: number; timeoutId?: number }> = new Map();
  private timestamps: Map<string, number> = new Map();
  private onTimeEvent: ((event: TimeEvent) => void) | null = null;

  constructor(engine: VirtualEngine, onTimeEvent?: (event: TimeEvent) => void) {
    this.engine = engine;
    this.onTimeEvent = onTimeEvent || null;
  }

  /**
   * @brief Starts a shared timer via VirtualEngine sharedData.
   * @param id The unique identifier for the timer.
   * @param duration The duration in milliseconds.
   */
  startTimer(id: string, duration: number) {
    const start = Date.now();
    this.timers.set(id, { start, duration });
    const timeoutId = setTimeout(() => {
      this.endTimer(id);
    }, duration);
    this.timers.get(id)!.timeoutId = timeoutId as unknown as number;
    const event: TimeEvent = { t: "timer_start", id, duration, timestamp: start };
    this.engine.setSharedData(`timer_${id}`, event);
    this.onTimeEvent?.(event);
  }

  /**
   * @brief Ends a timer.
   * @param id The unique identifier for the timer.
   */
  endTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      if (timer.timeoutId) clearTimeout(timer.timeoutId);
      this.timers.delete(id);
      const timestamp = Date.now();
      const event: TimeEvent = { t: "timer_end", id, timestamp };
      this.engine.setSharedData(`timer_${id}`, event);
      this.onTimeEvent?.(event);
    }
  }

  /**
   * @brief Sets a timestamp via sharedData.
   * @param key The key for the timestamp.
   * @param value The timestamp value (defaults to current time if not provided).
   */
  setTimestamp(key: string, value?: number) {
    const timestamp = value || Date.now();
    this.timestamps.set(key, timestamp);
    const event: TimeEvent = { t: "timestamp_update", key, value: timestamp };
    this.engine.setSharedData(`timestamp_${key}`, event);
    this.onTimeEvent?.(event);
  }

  /**
   * @brief Gets a timestamp.
   * @param key The key of the timestamp.
   * @return The timestamp value or undefined if not found.
   */
  getTimestamp(key: string): number | undefined {
    return this.timestamps.get(key);
  }

  /**
   * @brief Gets all timestamps.
   * @return An object containing all key-timestamp pairs.
   */
  getAllTimestamps(): Record<string, number> {
    return Object.fromEntries(this.timestamps);
  }

  destroy() {
    this.timers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId);
    });
    this.timers.clear();
  }
}