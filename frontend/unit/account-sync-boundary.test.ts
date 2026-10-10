import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AccountPatchQueue } from '../src/rumampu/account-sync.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(finish => { resolve = finish; });
  return { promise, resolve };
}

describe('account patch identity boundary', () => {
  it('drops queued edits from the previous account after sign-out', async () => {
    let authorization = 'Token account-a';
    const firstWrite = deferred();
    const firstStarted = deferred();
    const writes: Array<{ cash: number | undefined; authorization: string }> = [];
    const queue = new AccountPatchQueue(
      async () => authorization,
      async (fields, capturedAuthorization) => {
        writes.push({ cash: fields.cash_on_hand, authorization: capturedAuthorization });
        if (writes.length === 1) {
          firstStarted.resolve();
          await firstWrite.promise;
        }
      },
    );

    const first = queue.enqueue({ cash_on_hand: 10 });
    await firstStarted.promise;
    const stale = queue.enqueue({ cash_on_hand: 20 });
    queue.reset();
    authorization = 'Token account-b';
    await queue.enqueue({ cash_on_hand: 30 });
    firstWrite.resolve();
    await Promise.all([first, stale]);

    assert.deepEqual(writes, [
      { cash: 10, authorization: 'Token account-a' },
      { cash: 30, authorization: 'Token account-b' },
    ]);
  });

  it('drops an edit if identity changes while its token is being read', async () => {
    const tokenRead = deferred();
    const tokenStarted = deferred();
    const writes: string[] = [];
    const queue = new AccountPatchQueue(
      async () => { tokenStarted.resolve(); await tokenRead.promise; return 'Token account-a'; },
      async (_fields, authorization) => { writes.push(authorization); },
    );

    const stale = queue.enqueue({ cash_on_hand: 10 });
    await tokenStarted.promise;
    queue.reset();
    tokenRead.resolve();
    await stale;

    assert.deepEqual(writes, []);
  });
});
