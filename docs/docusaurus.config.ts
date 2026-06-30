import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// The site is local-only for now (no deploy workflow yet — see the README).
// These defaults are what a local `start`/`serve` uses; the `DOCUSAURUS_URL` /
// `DOCUSAURUS_BASE_URL` overrides are reserved for the future GitHub Pages
// deploy workflow (enabled once `ts-alpha` merges and 4.0 ships).
const url = process.env.DOCUSAURUS_URL ?? "https://alpacahq.github.io";
const baseUrl = process.env.DOCUSAURUS_BASE_URL ?? "/alpaca-trade-api-js/";

const config: Config = {
    title: "@alpacahq/alpaca-trade-api",
    tagline: "TypeScript SDK for the Alpaca Trading & Market Data APIs",
    url,
    baseUrl,
    organizationName: "alpacahq",
    projectName: "alpaca-trade-api-js",
    onBrokenLinks: "throw",
    onBrokenAnchors: "throw",
    // `detect` parses `.md` as CommonMark so the generated API reference pages
    // (raw `<details>` blocks and `{...}` inside code fences) aren't mis-parsed
    // as MDX/JSX, while still allowing `.mdx` where we want components.
    markdown: { format: "detect", hooks: { onBrokenMarkdownLinks: "warn" } },
    i18n: { defaultLocale: "en", locales: ["en"] },

    presets: [
        [
            "classic",
            {
                docs: {
                    routeBasePath: "/",
                    sidebarPath: "./sidebars.ts",
                    editUrl:
                        "https://github.com/alpacahq/alpaca-trade-api-js/edit/ts-alpha/docs/",
                },
                blog: false,
                theme: { customCss: "./src/css/custom.css" },
            } satisfies Preset.Options,
        ],
    ],

    // The API reference under `docs/docs/api/` is generated from the SDK's
    // capability maps by `scripts/gen-docs-api-reference.ts` (run by the docs
    // `prebuild`), giving the same curated, example-driven reference as the
    // README rather than verbose machine output.

    themeConfig: {
        announcementBar: {
            id: "alpha",
            content:
                "This documents the <strong>4.0 alpha</strong> line of @alpacahq/alpaca-trade-api.",
            isCloseable: true,
        },
        navbar: {
            title: "alpaca-trade-api",
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "docsSidebar",
                    position: "left",
                    label: "Docs",
                },
                {
                    href: "https://github.com/alpacahq/alpaca-trade-api-js",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
