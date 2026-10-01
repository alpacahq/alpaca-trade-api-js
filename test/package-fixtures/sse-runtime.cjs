const activity = {
    activity_type: "TRD",
    at: "2026-01-02T14:43:59Z",
    currency: "USD",
    event_id: "evt-package",
    executed_at: "2026-01-02T14:43:59Z",
    ref_id: "ref-package",
    settle_date: "2026-01-05",
    status: "executed",
    details: {
        asset_id: "asset-1",
        cum_qty: "1",
        execution_type: "fill",
        leaves_qty: "0",
        order_id: "order-1",
        order_status: "filled",
        side: "buy",
        symbol: "AAPL",
    },
};

function eventResponse() {
    const bytes = new TextEncoder().encode(
        `id: evt-package\ndata: ${JSON.stringify(activity)}\n\n`,
    );
    return new Response(
        new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            },
        }),
        {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
        },
    );
}

async function verifySseRuntime(sdk, label) {
    let requestUrl;
    let requestHeaders;
    const alpaca = new sdk.Alpaca({
        keyId: "package-key",
        secret: "package-secret",
        fetchApi: async (url, init) => {
            requestUrl = String(url);
            requestHeaders = new Headers(init?.headers);
            return eventResponse();
        },
    });

    const subscription = await alpaca.trading.subscribeActivities(
        {},
        { reconnect: false },
    );
    const events = [];
    for await (const event of subscription) events.push(event);

    if (
        events.length !== 1 ||
        events[0].activityType !== "TRD" ||
        events[0].details?.symbol !== "AAPL" ||
        !(events[0].at instanceof Date)
    ) {
        throw new Error(`${label} did not deserialize a typed SSE event`);
    }
    if (
        requestUrl !==
        "https://paper-api.alpaca.markets/v2beta1/events/activities"
    ) {
        throw new Error(`${label} used unexpected SSE URL ${requestUrl}`);
    }
    if (
        requestHeaders?.get("APCA-API-KEY-ID") !== "package-key" ||
        requestHeaders?.get("APCA-API-SECRET-KEY") !== "package-secret"
    ) {
        throw new Error(`${label} did not authenticate the SSE request`);
    }
}

module.exports = { verifySseRuntime };
