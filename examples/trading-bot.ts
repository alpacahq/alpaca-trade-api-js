/**
 * Minimal paper trading bot.
 *
 * Demonstrates: the `Alpaca` facade, reading the account (with the `values`
 * money helpers), a market-data lookup, the ergonomic order builders
 * (`orders.limit`), the trade-updates stream (with the awaitable auth handshake
 * and reconnect-lifecycle listeners), `submitAndWait` (place an order and block
 * until it reaches a terminal state), and typed-error handling branching on the
 * `ApiError` subclasses.
 *
 * Run:
 *   APCA_API_KEY_ID=... APCA_API_SECRET_KEY=... npx tsx examples/trading-bot.ts
 */
// In your own app this import is just:
//   import { Alpaca, ApiError, FetchError, RateLimitError, values } from "@alpacahq/alpaca-trade-api";
import { Alpaca, ApiError, FetchError, RateLimitError, values } from "../src/index";

async function main(): Promise<void> {
    const keyId = process.env.APCA_API_KEY_ID;
    const secret = process.env.APCA_API_SECRET_KEY;
    if (!keyId || !secret) {
        console.error("Set APCA_API_KEY_ID and APCA_API_SECRET_KEY in the environment.");
        process.exit(1);
    }

    const alpaca = new Alpaca({
        keyId,
        secret,
        paper: true,
        timeoutMs: 10_000,
        retry: { maxRetries: 3 }, // covers transient 5xx and network errors on safe GETs, never order POSTs
    });

    // Money/quantity fields are wire-truthful strings; format them for display
    // with the `values` helpers instead of printing the raw string.
    const account = await alpaca.trading.account.getAccount();
    console.log(
        `account ${account.accountNumber} status=${account.status} ` +
            `buyingPower=${values.formatMoney(account.buyingPower)} ` +
            `equity=${values.formatMoney(account.equity)}`,
    );

    const price = await alpaca.marketData.getLatestPrice("AAPL");
    console.log(`AAPL last trade: ${price ?? "n/a"}`);

    // Stream order/account updates in the background.
    const updates = alpaca.trading.stream();
    updates.onTradeUpdate((u) => console.log(`trade update: ${u.event} ${u.order.symbol} -> ${u.order.status}`));
    updates.onError((msg) => console.error("stream error:", msg));
    // Observe the reconnect lifecycle (auto-reconnect with backoff is built in).
    updates.onReconnecting((attempt) => console.warn(`stream reconnecting (attempt ${attempt})`));
    // This means re-subscription was dispatched, not acknowledged by the server.
    updates.onReconnected(() => console.info("stream reconnected; subscriptions dispatched"));
    updates.onConnect(() => updates.subscribeTradeUpdates());
    updates.connect();

    // Await the authentication handshake (typed result; never throws). Bail out
    // early on bad credentials instead of placing orders against a dead stream.
    const auth = await updates.waitForAuthenticationResult(10_000);
    if (!auth.authenticated) {
        console.error(`trade-updates stream auth ${auth.status}: ${auth.message}${auth.code ? ` (code ${auth.code})` : ""}`);
        updates.disconnect();
        process.exit(1);
    }

    // A stable, unique client ID makes this placement auditable and provides
    // the reconciliation key if the transport fails after Alpaca receives it.
    const restingClientOrderId = newClientOrderId("resting-limit-aapl");

    // Ergonomic order builder: a limit buy well below the market rests without
    // filling. The typed `orders.limit` builder requires `limitPrice` at compile
    // time and accepts `number | string` amounts. We place then cancel it to
    // show both the builder and a raw generated method (`deleteOrderByOrderID`).
    try {
        let resting: Awaited<ReturnType<typeof alpaca.trading.orders.limit>>;
        try {
            resting = await alpaca.trading.orders.limit({
                symbol: "AAPL",
                qty: 1,
                side: "buy",
                limitPrice: Math.max(1, Math.floor((price ?? 100) * 0.5)),
                clientOrderId: restingClientOrderId,
            });
        } catch (err) {
            if (!(err instanceof FetchError)) throw err;

            // The POST outcome is ambiguous. Reconcile by client ID before any
            // further submission; a failed lookup is not proof that placement
            // failed, so this example stops instead of risking another order.
            try {
                resting = await alpaca.trading.orders.getOrderByClientOrderId({
                    clientOrderId: restingClientOrderId,
                });
                console.warn(`reconciled ambiguous placement as order ${resting.id}`);
            } catch (lookupError) {
                reportError("limit order reconciliation", lookupError);
                updates.disconnect();
                return;
            }
        }
        console.log(`placed resting limit order ${resting.id} @ ${resting.limitPrice}`);
        if (resting.id) {
            await alpaca.trading.orders.deleteOrderByOrderID({ orderId: resting.id });
            console.log(`canceled ${resting.id}`);
        }
    } catch (err) {
        reportError("limit order", err);
    }

    // `submitAndWait` waits for Alpaca's listening acknowledgement, places once
    // per invocation, and never re-places on reconnect. It preserves this
    // client ID and uses one deadline for subscription, REST, and terminal wait.
    // Only this workflow makes one client-ID GET after an ambiguous FetchError;
    // the generic order builders require the explicit recovery shown above.
    try {
        const order = await alpaca.trading.submitAndWait(
            {
                type: "market",
                symbol: "AAPL",
                qty: 1,
                side: "buy",
                clientOrderId: newClientOrderId("market-aapl"),
            },
            { timeoutMs: 30_000, stream: updates },
        );
        console.log(`order ${order.id} reached ${order.status} (filledAvgPrice=${order.filledAvgPrice ?? "n/a"})`);
    } catch (err) {
        reportError("submitAndWait", err);
    } finally {
        updates.disconnect();
    }
}

/** Human-readable strategy prefix plus collision-resistant Node 20 UUID. */
function newClientOrderId(purpose: string): string {
    return `${purpose}-${globalThis.crypto.randomUUID()}`;
}

/** Branch on the typed-error subclasses; always log the request id on an ApiError. */
function reportError(label: string, err: unknown): void {
    if (err instanceof RateLimitError) {
        console.error(`${label} rate limited; retry in ${err.retryAfterMs ?? "?"}ms (request ${err.requestId})`);
    } else if (err instanceof ApiError) {
        console.error(`${label} rejected: HTTP ${err.status} ${err.code ?? ""} ${err.message} (request ${err.requestId})`);
    } else {
        console.error(`${label} failed:`, (err as Error).message);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
