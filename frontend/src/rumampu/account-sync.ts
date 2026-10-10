import type { AccountStatePatch } from './api';

/**
 * Return only declarations changed on this device since its last account
 * snapshot. Sending a complete snapshot would let one device's stale reading
 * progress overwrite another device's reminder edit (and vice versa).
 */
export function changedAccountFields(
  previous: AccountStatePatch,
  current: AccountStatePatch,
): Partial<AccountStatePatch> {
  const changed: Partial<AccountStatePatch> = {};
  for (const key of Object.keys(current) as Array<keyof AccountStatePatch>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      // Each property is copied as one validated PATCH field. The indexed
      // assignment is safe because the value comes from the same key.
      (changed as Record<keyof AccountStatePatch, unknown>)[key] = current[key];
    }
  }
  return changed;
}
