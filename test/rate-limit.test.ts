import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RateLimiter } from '../src/rate-limit';

describe('RateLimiter - request rate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows up to maxRequests immediately, then queues until refill', async () => {
        const limiter = new RateLimiter({ maxRequests: 2, intervalMs: 1000 });
        const order: number[] = [];

        const p1 = limiter.acquire().then(() => order.push(1));
        const p2 = limiter.acquire().then(() => order.push(2));
        const p3 = limiter.acquire().then(() => order.push(3));

        // First two have tokens; third must wait for a refill.
        await Promise.resolve();
        await p1;
        await p2;
        expect(order).toEqual([1, 2]);

        // Refill rate is 2 tokens / 1000ms = 1 token / 500ms.
        await vi.advanceTimersByTimeAsync(500);
        await p3;
        expect(order).toEqual([1, 2, 3]);
    });

    it('preserves FIFO order across refills', async () => {
        const limiter = new RateLimiter({ maxRequests: 1, intervalMs: 1000 });
        const order: number[] = [];

        await limiter.acquire().then(() => order.push(0)); // consumes the only token

        const pending = [1, 2, 3].map((n) => limiter.acquire().then(() => order.push(n)));

        await vi.advanceTimersByTimeAsync(1000); // +1 token
        await pending[0];
        await vi.advanceTimersByTimeAsync(1000); // +1 token
        await pending[1];
        await vi.advanceTimersByTimeAsync(1000); // +1 token
        await pending[2];

        expect(order).toEqual([0, 1, 2, 3]);
    });
});

describe('RateLimiter - concurrency cap', () => {
    it('holds further acquisitions until a slot is released', async () => {
        // Plenty of rate budget; the bottleneck is maxConcurrent.
        const limiter = new RateLimiter({ maxRequests: 100, intervalMs: 1000, maxConcurrent: 1 });
        const order: string[] = [];

        const release1 = await limiter.acquire();
        order.push('a-acquired');

        let release2: (() => void) | undefined;
        const p2 = limiter.acquire().then((r) => {
            release2 = r;
            order.push('b-acquired');
        });

        // b cannot proceed while a holds the single slot.
        await Promise.resolve();
        expect(order).toEqual(['a-acquired']);

        release1();
        await p2;
        expect(order).toEqual(['a-acquired', 'b-acquired']);
        release2?.();
    });
});

describe('RateLimiter - abort', () => {
    it('rejects a queued waiter when its signal aborts', async () => {
        const limiter = new RateLimiter({ maxRequests: 1, intervalMs: 60_000 });
        await limiter.acquire(); // exhaust the bucket

        const controller = new AbortController();
        const pending = limiter.acquire(controller.signal);
        controller.abort();

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('rejects immediately if the signal is already aborted', async () => {
        const limiter = new RateLimiter({ maxRequests: 5, intervalMs: 1000 });
        const controller = new AbortController();
        controller.abort();
        await expect(limiter.acquire(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    });
});
