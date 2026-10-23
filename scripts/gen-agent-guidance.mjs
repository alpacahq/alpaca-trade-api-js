import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_FRONTMATTER = `---
name: alpaca-trade-api-sdk
description: >-
  Integrate and build on @alpacahq/alpaca-trade-api, the Alpaca
  JavaScript/TypeScript SDK for the Trading and Market Data APIs (the unified
  Alpaca client, ergonomic
  order builders, normalized market-data shapes, pagination, typed errors,
  resilience, and real-time streaming). Use when writing or reviewing code that
  imports @alpacahq/alpaca-trade-api, places orders, fetches bars/trades/quotes,
  opens market-data or trading WebSocket streams, or builds a trading bot,
  backtester, or market-data backend on top of this SDK.
---`;

export function renderAgentSkill(llms) {
    return `${SKILL_FRONTMATTER}\n\n${llms}`;
}

function main(args = process.argv.slice(2)) {
    const unknown = args.filter((argument) => argument !== "--check");
    if (unknown.length > 0) {
        throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
    }

    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const llmsFile = resolve(root, "LLMS.md");
    const skillFile = resolve(
        root,
        "skills",
        "alpaca-trade-api-sdk",
        "SKILL.md",
    );
    const expected = renderAgentSkill(readFileSync(llmsFile, "utf8"));

    if (args.includes("--check")) {
        const actual = readFileSync(skillFile, "utf8");
        if (actual !== expected) {
            console.error(
                "Agent Skill is stale. Run `npm run agent:skill` and commit the result.",
            );
            process.exitCode = 1;
            return;
        }
        console.log("Agent Skill matches LLMS.md.");
        return;
    }

    writeFileSync(skillFile, expected);
    console.log(`Wrote ${skillFile}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
