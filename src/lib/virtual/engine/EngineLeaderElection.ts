import type { WindowSnapshot } from "../types/types";

// ==========================================
// Leader Election Logic
// ==========================================

/**
 * @brief Sorts potential leader candidates by creation time (age).
 * 
 * Oldest windows come first.
 * Tie-Breaker: If two windows have the exact same creation timestamp, 
 * the Window ID is used alphabetically for deterministic order.
 *
 * @param candidates Array of window snapshots.
 * @returns Sorted array (Leader candidate at index 0).
 */
export function sortCandidatesForLeadership(candidates: WindowSnapshot[]): WindowSnapshot[] {
  return [...candidates].sort((a, b) => {
    // Primary sort: Lifecycle Age (older = smaller timestamp)
    const timeDiff = a.createdAt - b.createdAt;
    if (timeDiff !== 0) return timeDiff;

    // Secondary sort: ID (Deterministic tie-breaker)
    return a.id.localeCompare(b.id);
  });
}

/**
 * @brief Determines the current leader from a list of active windows.
 * 
 * @param allWindows List of all known peer windows.
 * @param myWindow The snapshot of the current window.
 * @param timeout Timeout in ms to consider a window valid/active.
 * @returns Object containing the leaderId and a boolean isMe.
 */
export function selectLeader(
  allWindows: WindowSnapshot[],
  myWindow: WindowSnapshot,
  timeout: number
): {
  leaderId: string | undefined;
  isMe: boolean;
} {
  const now = Date.now();

  // 1. Filter active candidates (not timed out)
  const activeCandidates = [...allWindows, myWindow].filter(
    (w) => now - w.lastSeen < timeout
  );

  if (activeCandidates.length === 0) {
    return { leaderId: undefined, isMe: false };
  }

  // 2. Sort to find the "Eldest"
  const sorted = sortCandidatesForLeadership(activeCandidates);
  const leader = sorted[0];

  return {
    leaderId: leader.id,
    isMe: leader.id === myWindow.id,
  };
}

