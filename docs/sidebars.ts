import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
    docsSidebar: [
        "intro",
        "getting-started",
        {
            type: "category",
            label: "SDK Areas",
            collapsed: false,
            items: [
                "trading",
                "market-data",
                { type: "doc", id: "streaming", label: "Streaming & Events" },
            ],
        },
        {
            type: "category",
            label: "Guides",
            collapsed: false,
            items: [
                "authentication",
                "resilience",
                "pagination",
                "types-and-values",
                "testing",
                "runtime-compatibility",
                { type: "doc", id: "examples", label: "Examples" },
            ],
        },
    ],
    // These documents are generated before Docusaurus runs.
    apiSidebar: [
        "api/index",
        "api/trading",
        "api/market-data",
        "api/streaming",
        "api/ergonomic-helpers",
    ],
};

export default sidebars;
