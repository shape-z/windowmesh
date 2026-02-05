import { nanoid } from "nanoid";

const KEY = "vwin:id";

export function getThisWindowID(): string {
  // Returning a new ID every time ensures that duplicated tabs (which copy sessionStorage)
  // do not end up with the same ID, causing conflicts in the mesh network.
  // This means a reload (F5) will also join as a "new" participant.
  return nanoid(10);
}
