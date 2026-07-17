/**
 * Proactive, client-side rate limiting for the Alpaca SDK.
 *
 * Alpaca enforces roughly 200 requests/minute. The transport's `retry` policy
 * only *reacts* to 429s; this limiter *prevents* them by smoothing outgoing
 * requests through a token bucket before they hit the wire. An app fanning out
 * historical pulls for hundreds of symbols therefore self-throttles instead of
 * hammering the API and relying on backoff to recover.
 *
 * Dependency-free and transport-agnostic. One {@link RateLimiter} is shared by
 * every `Api` built from the same `Configuration` (i.e. a whole sub-client), so
 * the trading and market-data hosts are throttled independently.
 *
 * This module is hand-written and lives outside the generated trees, which are
 * kept untouched as a faithful snapshot of the OpenAPI spec.
 */

/** Tuning for the client-side {@link RateLimiter}. */
export interface RateLimitConfig {
    /** Requests permitted per {@link intervalMs} window. Default `200`. */
    maxRequests?: number;
    /** Length of the refill window in milliseconds. Default `60000` (1 min). */
    intervalMs?: number;
    /**
     * Optional cap on concurrently in-flight requests. Default unlimited.
     * A slot is held from {@link RateLimiter.acquire} until the returned
     * release callback is invoked.
     */
    maxConcurrent?: number;
}

interface Waiter {
    resolve: (release: () => void) => void;
    reject: (err: Error) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
    settled: boolean;
}

function abortError(signal: AbortSignal): Error {
    const reason = (signal as { reason?: unknown }).reason;
    if (reason instanceof Error) {
        return reason;
    }
    if (typeof DOMException !== "undefined") {
        return new DOMException("The rate-limit wait was aborted", "AbortError");
    }
    const err = new Error("The rate-limit wait was aborted");
    err.name = "AbortError";
    return err;
}

/**
 * Token-bucket limiter. Tokens refill continuously at
 * `maxRequests / intervalMs` per ms (capped at `maxRequests`). {@link acquire}
 * resolves as soon as a token (and a concurrency slot, if configured) is
 * available, otherwise it queues FIFO. If the supplied `AbortSignal` fires
 * while queued, the wait rejects.
 */
export class RateLimiter {
    private readonly maxRequests: number;
    private readonly intervalMs: number;
    private readonly maxConcurrent: number;
    private tokens: number;
    private lastRefill: number;
    private active = 0;
    private queue: Waiter[] = [];
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(config: RateLimitConfig = {}) {
        this.maxRequests = Math.max(1, config.maxRequests ?? 200);
        this.intervalMs = Math.max(1, config.intervalMs ?? 60_000);
        this.maxConcurrent =
            config.maxConcurrent != null && config.maxConcurrent > 0
                ? config.maxConcurrent
                : Infinity;
        this.tokens = this.maxRequests;
        this.lastRefill = Date.now();
    }

    /**
     * Wait for a slot. Resolves with a `release()` callback that frees the
     * concurrency slot (a no-op for the token budget, which is already spent).
     * Always invoke `release()` once the request settles.
     */
    acquire(signal?: AbortSignal): Promise<() => void> {
        if (signal?.aborted) {
            return Promise.reject(abortError(signal));
        }
        return new Promise<() => void>((resolve, reject) => {
            const waiter: Waiter = { resolve, reject, signal, settled: false };
            if (signal) {
                waiter.onAbort = () => this.rejectWaiter(waiter, abortError(signal));
                signal.addEventListener("abort", waiter.onAbort, { once: true });
            }
            this.queue.push(waiter);
            this.drain();
        });
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        if (elapsed > 0) {
            this.tokens = Math.min(
                this.maxRequests,
                this.tokens + (elapsed * this.maxRequests) / this.intervalMs,
            );
            this.lastRefill = now;
        }
    }

    private drain(): void {
        this.refill();
        while (this.queue.length > 0 && this.tokens >= 1 && this.active < this.maxConcurrent) {
            const waiter = this.queue.shift();
            if (!waiter) {
                break;
            }
            if (waiter.settled) {
                continue; // aborted while queued
            }
            this.tokens -= 1;
            this.active += 1;
            this.settle(waiter);
            waiter.resolve(this.makeRelease());
        }
        this.scheduleDrain();
    }

    private makeRelease(): () => void {
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            this.active = Math.max(0, this.active - 1);
            this.drain();
        };
    }

    private scheduleDrain(): void {
        if (this.timer || this.queue.length === 0) {
            return;
        }
        // If we're only blocked on concurrency, release() will re-drain.
        if (this.tokens >= 1) {
            return;
        }
        const needed = 1 - this.tokens;
        const wait = Math.max(1, Math.ceil((needed * this.intervalMs) / this.maxRequests));
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.drain();
        }, wait);
        // Don't keep the process alive just for the limiter (Node only).
        const timer = this.timer as { unref?: () => void };
        if (typeof timer.unref === "function") {
            timer.unref();
        }
    }

    private settle(waiter: Waiter): void {
        waiter.settled = true;
        if (waiter.signal && waiter.onAbort) {
            waiter.signal.removeEventListener("abort", waiter.onAbort);
        }
    }

    private rejectWaiter(waiter: Waiter, err: Error): void {
        if (waiter.settled) {
            return;
        }
        this.settle(waiter);
        const idx = this.queue.indexOf(waiter);
        if (idx !== -1) {
            this.queue.splice(idx, 1);
        }
        waiter.reject(err);
    }
}
