/**
 * Minimal market-data backend for a visualization frontend.
 *
 * - GET /stream            Server-Sent Events of live bars for the configured symbols.
 * - GET /price?symbol=AAPL Latest trade price (REST).
 * - GET /bars?symbol=AAPL  Historical bars as canonical `Bar`s (REST, auto-paginated).
 * - GET /candles?symbol=AAPL Historical bars as chart-ready columnar `Candles`.
 *
 * Demonstrates: a long-lived market-data WebSocket (with reconnect-lifecycle
 * listeners) fanned out to many HTTP clients, plus REST helpers and
 * auto-pagination - no extra web framework. The live `/stream` bars and the
 * historical `/bars` share ONE shape (`Bar`), so a frontend can backfill history
 * then append live updates without remapping.
 * Upstream failures are surfaced as typed `ApiError`s, mapped to the right HTTP
 * status with Alpaca's request id for debugging.
 *
 * Run:
 *   APCA_API_KEY_ID=... APCA_API_SECRET_KEY=... npx tsx examples/marketdata-backend.ts
 *   curl -N http://localhost:8080/stream
 *   curl http://localhost:8080/price?symbol=AAPL
 */
import * as http from "node:http";
// In your own app this import is just: import { Alpaca, TimeFrame, ApiError } from "@alpacahq/alpaca-trade-api";
import { Alpaca, TimeFrame, ApiError } from "../src/index";

const keyId = process.env.APCA_API_KEY_ID;
const secret = process.env.APCA_API_SECRET_KEY;
if (!keyId || !secret) {
    console.error("Set APCA_API_KEY_ID and APCA_API_SECRET_KEY in the environment.");
    process.exit(1);
}

const PORT = Number(process.env.PORT ?? 8080);
const SYMBOLS = (process.env.SYMBOLS ?? "AAPL,MSFT").split(",");

const alpaca = new Alpaca({ keyId, secret });

// Fan live bars out to every connected SSE client.
const clients = new Set<http.ServerResponse>();
const stream = alpaca.marketData.stockStream({ feed: "iex" });
stream.onBar((bar) => {
    const frame = `data: ${JSON.stringify(bar)}\n\n`;
    for (const res of clients) res.write(frame);
});
stream.onError((msg) => console.error("stream error:", msg));
// The client auto-reconnects with backoff and restores subscriptions; surface
// the lifecycle so the backend can log/observe gaps in the feed.
stream.onReconnecting((attempt) => console.warn(`market-data stream reconnecting (attempt ${attempt})`));
stream.onReconnected(() => console.info("market-data stream reconnected; subscriptions restored"));
stream.onConnect(() => stream.subscribeForBars(SYMBOLS));
stream.connect();

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    try {
        if (url.pathname === "/stream") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            res.write(": connected\n\n");
            clients.add(res);
            req.on("close", () => clients.delete(res));
            return;
        }
        if (url.pathname === "/price") {
            const symbol = url.searchParams.get("symbol") ?? SYMBOLS[0];
            const price = await alpaca.marketData.getLatestPrice(symbol);
            sendJson(res, 200, { symbol, price });
            return;
        }
        if (url.pathname === "/bars") {
            const symbol = url.searchParams.get("symbol") ?? SYMBOLS[0];
            // Canonical Bar[] - the same shape the /stream bars arrive in.
            const bars = await alpaca.marketData.getStockBars({
                symbols: [symbol],
                timeframe: TimeFrame.Day,
                start: new Date(url.searchParams.get("start") ?? "2024-01-01"),
            });
            sendJson(res, 200, bars);
            return;
        }
        if (url.pathname === "/candles") {
            const symbol = url.searchParams.get("symbol") ?? SYMBOLS[0];
            // Columnar { time[], open[], high[], low[], close[], volume[] } for charts.
            const candles = await alpaca.marketData.getStockCandles({
                symbols: [symbol],
                timeframe: TimeFrame.Day,
                start: new Date(url.searchParams.get("start") ?? "2024-01-01"),
            });
            sendJson(res, 200, candles);
            return;
        }
        sendJson(res, 404, { error: "not found" });
    } catch (err) {
        // Map an upstream Alpaca failure to its real status, and surface the
        // request id so the failure is traceable in Alpaca's systems.
        if (err instanceof ApiError) {
            sendJson(res, err.status, { error: err.message, code: err.code, requestId: err.requestId });
        } else {
            sendJson(res, 500, { error: (err as Error).message });
        }
    }
});

server.listen(PORT, () => {
    console.log(`listening on http://localhost:${PORT} (streaming bars for ${SYMBOLS.join(", ")})`);
});
