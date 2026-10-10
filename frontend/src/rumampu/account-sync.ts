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

/** Keep writes ordered within an account and discard work from older sessions. */
export class AccountPatchQueue {
  private generation = 0;
  private tail: Promise<void> = Promise.resolve();
  private readonly authorization: () => Promise<string | null>;
  private readonly patch: (fields: Partial<AccountStatePatch>, authorization: string) => Promise<unknown>;

  constructor(
    authorization: () => Promise<string | null>,
    patch: (fields: Partial<AccountStatePatch>, authorization: string) => Promise<unknown>,
  ) {
    this.authorization = authorization;
    this.patch = patch;
  }

  reset(): void {
    this.generation += 1;
    this.tail = Promise.resolve();
  }

  enqueue(fields: Partial<AccountStatePatch>): Promise<void> {
    const generation = this.generation;
    this.tail = this.tail.then(async () => {
      if (generation !== this.generation) return;
      const authorization = await this.authorization();
      if (generation !== this.generation || !authorization) return;
      // The captured header remains bound to this account even if logout starts
      // while performRequest is awaiting its other identity headers.
      await this.patch(fields, authorization);
    }).catch(() => undefined);
    return this.tail;
  }
}
