# {{APP_NAME}}

Alpaca paper trading and market data dashboard generated locally with the
`starter-dashboard` skill.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The generated `.env.local` contains paper trading credentials and
`APCA_PAPER="true"`. It is ignored by git. Replace placeholder values with paper
credentials from the Alpaca dashboard before running the app.

## What This App Demonstrates

- A single `Alpaca` client from `@alpacahq/alpaca-ts-alpha`.
- Trading API reads for account, positions, assets, and orders.
- Market Data API reads for latest price and historical daily bars.
- REST-only server rendering and server actions; no WebSocket or SSE route.
- Ergonomic order helpers: `alpaca.trading.orders.market()` and `.limit()`.
- Typed `ApiError` handling with request ids.

## UI

- Styled with Tailwind CSS v4 (CSS-first config in `app/globals.css` via
  `@theme`; no `tailwind.config.js`).
- Light theme built on the 2026 Alpaca brand palette: semantic tokens are
  derived from the brand primitives (Alpaca Yellow brand accent, warm Alpaca
  Gray neutrals, Green/Red for P/L) rather than raw ramp values.
- Semantic P/L coloring (green up, red down), `lucide-react` icons, an SVG
  gradient price chart, and `next/font` (Inter + JetBrains Mono).
- Pages are `force-dynamic` so account and market data are always fresh.

The app is intentionally small. It is a starting point for learning the SDK, not
a production trading system.
