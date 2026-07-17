import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// The GitHub Pages deploy workflow (`.github/workflows/docs.yaml`) sets
// `DOCUSAURUS_URL` / `DOCUSAURUS_BASE_URL`; these defaults match that deploy
// target and are also what a local `start`/`serve` uses.
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
                        "https://github.com/alpacahq/alpaca-trade-api-js/edit/master/docs/",
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
            id: "v4",
            content: `This documents <strong>4.0</strong> of @alpacahq/alpaca-trade-api — a full rewrite. Upgrading from 3.x? See the <a href="${baseUrl}migration">migration guide</a>.`,
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
                    type: "doc",
                    docId: "migration",
                    position: "left",
                    label: "Migration",
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
