type RuntimeGlobals = unknown;

const HEADER_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function isStructuralObject(value: unknown): value is object {
    return (
        (typeof value === "object" && value !== null) ||
        typeof value === "function"
    );
}

function readProperty(value: unknown, key: PropertyKey): unknown {
    if (!isStructuralObject(value)) {
        return undefined;
    }
    try {
        return Reflect.get(value, key);
    } catch {
        return undefined;
    }
}

function safeVersion(value: unknown): string {
    return typeof value === "string" &&
        value.length > 0 &&
        HEADER_TOKEN.test(value)
        ? value
        : "unknown";
}

export function detectRuntimeIdentity(globals: RuntimeGlobals): string {
    const bun = readProperty(globals, "Bun");
    if (isStructuralObject(bun)) {
        return `Bun/${safeVersion(readProperty(bun, "version"))}`;
    }

    const deno = readProperty(globals, "Deno");
    if (isStructuralObject(deno)) {
        const version = readProperty(deno, "version");
        return `Deno/${safeVersion(readProperty(version, "deno"))}`;
    }

    const process = readProperty(globals, "process");
    if (isStructuralObject(process)) {
        const versions = readProperty(process, "versions");
        const nodeVersion = readProperty(versions, "node");
        if (nodeVersion !== undefined) {
            return `Node/${safeVersion(nodeVersion)}`;
        }
    }

    return "Unknown/unknown";
}

export function formatUserAgent(
    sdkVersion: unknown,
    globals: RuntimeGlobals = globalThis,
): string {
    return `APCA-NODE/${safeVersion(sdkVersion)} ${detectRuntimeIdentity(globals)}`;
}
