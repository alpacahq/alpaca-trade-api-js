import { Alpaca, type SseSubscription } from "../src";

const REQUIRED_WINDOWS = [
    "APCA_SSE_ACTIVITY_SINCE",
    "APCA_SSE_ACTIVITY_UNTIL",
    "APCA_SSE_CORPORATE_ACTIONS_SINCE",
    "APCA_SSE_CORPORATE_ACTIONS_UNTIL",
] as const;

function requiredDate(name: (typeof REQUIRED_WINDOWS)[number]): Date {
    const raw = process.env[name];
    if (!raw) {
        throw new Error(
            `Missing ${name}; provide a bounded replay window known to contain at least one event`,
        );
    }
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) {
        throw new Error(`${name} must be an RFC 3339 timestamp`);
    }
    return value;
}

async function assertFirstEvent<T extends { eventId?: string }>(
    label: string,
    subscription: SseSubscription<T>,
): Promise<void> {
    try {
        for await (const event of subscription) {
            if (!event || typeof event !== "object") {
                throw new Error(`${label} produced an invalid event`);
            }
            console.log(`${label}: received ${event.eventId ?? "(no event id)"}`);
            return;
        }
        throw new Error(
            `${label} replay ended without an event; choose a window containing known data`,
        );
    } finally {
        subscription.close();
    }
}

async function main(): Promise<void> {
    const activitySince = requiredDate("APCA_SSE_ACTIVITY_SINCE");
    const activityUntil = requiredDate("APCA_SSE_ACTIVITY_UNTIL");
    const corporateSince = requiredDate("APCA_SSE_CORPORATE_ACTIONS_SINCE");
    const corporateUntil = requiredDate("APCA_SSE_CORPORATE_ACTIONS_UNTIL");

    const alpaca = new Alpaca({
        paper: process.env.APCA_PAPER !== "false",
        sandbox: process.env.APCA_MARKET_DATA_SANDBOX === "true",
    });
    const options = {
        reconnect: false,
        connectTimeoutMs: 10_000,
        maxDurationMs: 30_000,
    } as const;

    await assertFirstEvent(
        "trading activities SSE",
        await alpaca.trading.events.subscribeToActivitiesSSE(
            { since: activitySince, until: activityUntil },
            options,
        ),
    );
    await assertFirstEvent(
        "corporate actions SSE",
        await alpaca.marketData.corporateActions.subscribeToCorporateActionsEventsSSE(
            { since: corporateSince, until: corporateUntil },
            options,
        ),
    );
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
