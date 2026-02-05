import { useSyncExternalStore } from 'react';
import type { VirtualEngine } from '../engine/VirtualEngine';
import type { VirtualState } from '../types/types';

/**
 * Hook to subscribe to a selector of the virtual state.
 * @param engine The VirtualEngine instance.
 * @param selector Function to select part of the state.
 * @returns The selected state value or null if engine is null.
 */
export function useVirtualStore<SelectorOutput>(
  engine: VirtualEngine | null,
  selector: (state: VirtualState) => SelectorOutput
): SelectorOutput | null {
  return useSyncExternalStore(
    (callback) => engine?.store.subscribe(() => callback()) || (() => {}),
    () => engine ? selector(engine.store.get()) : null,
    () => null // Server snapshot
  );
}

/**
 * Hook to get the full virtual state.
 * @param engine The VirtualEngine instance.
 * @returns The virtual state or null if engine is null.
 */
export function useVirtualState(engine: VirtualEngine | null) {
  return useSyncExternalStore(
    (cb) => engine?.store.subscribe(cb) || (() => {}),
    () => engine?.store.get() || null,
    () => null // Server snapshot
  );
}
