import { describe, it, expect } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  it('resolves with the original value when it settles before the timeout', async () => {
    const fast = Promise.resolve('ok');
    await expect(withTimeout(fast, 1000)).resolves.toBe('ok');
  });

  it('rejects once the timeout elapses before the promise settles', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('too-late'), 50));
    await expect(withTimeout(slow, 10)).rejects.toThrow('timeout');
  });

  it('accepts a Supabase-style thenable (PromiseLike, not a real Promise)', async () => {
    const thenable = {
      then<T>(onFulfilled: (value: string) => T) {
        return Promise.resolve(onFulfilled('thenable-ok'));
      },
    };
    await expect(withTimeout(thenable, 1000)).resolves.toBe('thenable-ok');
  });

  it('propagates rejection from the original promise', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow('boom');
  });
});
