

type Listener<T> = (state: T) => void;

export class Store<T> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * @brief Returns the current state snapshot.
   * @returns Current state object.
   */
  get(): T {
    return this.state;
  }

  /**
   * @brief Updates the state and notifies listeners.
   * 
   * Accepts either a partial state object to merge, 
   * or a function that receives current state and returns partial state.
   * 
   * @param newState Partial state or updater function.
   */
  set(newState: Partial<T> | ((prev: T) => Partial<T>)) {
    const changes =
      typeof newState === "function"
        ? (newState as (prev: T) => Partial<T>)(this.state)
        : newState;

    this.state = { ...this.state, ...changes };
    this.emit();
  }

  /**
   * @brief Atomically updates a nested property using a mutable draft pattern.
   * 
   * Useful to avoid deep cloning complex state objects manually.
   * 
   * @param updater Function that mutates the passed draft state.
   */
  update(updater: (draft: T) => void) {
    const nextState = { ...this.state };
    updater(nextState);
    this.state = nextState;
    this.emit();
  }

  /**
   * @brief Subscribes to state changes.
   * @param listener Callback function receiving the new state.
   * @returns Unsubscribe function.
   */
  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private emit() {
    this.listeners.forEach((l) => {
      try {
        l(this.state);
      } catch (error) {
        console.error("[Store] Listener error:", error);
      }
    });
  }
}

