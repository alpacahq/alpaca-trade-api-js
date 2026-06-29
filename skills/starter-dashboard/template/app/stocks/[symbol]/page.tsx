import { TimeFrame } from "@alpacahq/alpaca-ts-alpha";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Delta } from "@/components/ui";
import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";
import { formatDate, formatMoney, formatNumber, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";

type Candle = { timestamp: Date; high: number; low: number; close: number; volume: number };

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<{ range?: RangeKey }>;
};

type RangeKey = "1M" | "3M" | "6M" | "1Y";

const RANGES: Record<RangeKey, { days: number; maxBars: number }> = {
  "1M": { days: 30, maxBars: 31 },
  "3M": { days: 90, maxBars: 70 },
  "6M": { days: 180, maxBars: 140 },
  "1Y": { days: 365, maxBars: 260 },
};

function normalizeRange(value: string | undefined): RangeKey {
  return value === "1M" || value === "3M" || value === "6M" || value === "1Y"
    ? value
    : "3M";
}

export default async function StockDetailPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const range = normalizeRange((await searchParams)?.range);
  const normalizedSymbol = symbol.toUpperCase();
  const alpaca = getAlpaca();
  const selectedRange = RANGES[range];
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - selectedRange.days);

  try {
    const [asset, price, bars] = await Promise.all([
      alpaca.trading.assets.getV2AssetsSymbolOrAssetId({
        symbolOrAssetId: normalizedSymbol,
      }),
      alpaca.marketData.getLatestPrice(normalizedSymbol, { feed: "iex" }),
      alpaca.marketData.getStockBarsFor(
        normalizedSymbol,
        {
          timeframe: TimeFrame.Day,
          start,
          end,
          adjustment: "all",
          feed: "iex",
        },
        { maxPerSymbol: selectedRange.maxBars },
      ),
    ]);

    if (asset._class !== "us_equity") {
      notFound();
    }

    const firstClose = bars[0]?.close ?? null;
    const lastClose = bars.at(-1)?.close ?? null;
    const periodChange =
      firstClose !== null && lastClose !== null ? lastClose - firstClose : null;
    const periodChangePct =
      periodChange !== null && firstClose ? periodChange / firstClose : null;
    const periodHigh = bars.length ? Math.max(...bars.map((bar) => bar.high)) : null;
    const periodLow = bars.length ? Math.min(...bars.map((bar) => bar.low)) : null;

    return (
      <div className="grid gap-8">
        <div className="grid gap-5">
          <Link
            href="/stocks"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted no-underline transition hover:text-ink"
          >
            <ArrowLeft size={16} strokeWidth={2.25} />
            Back to stocks
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-1.5">
              <p className="eyebrow">Trading + Market Data APIs</p>
              <h1 className="mono">{asset.symbol}</h1>
              <p className="text-sm text-muted">{asset.name}</p>
            </div>
            <div className="grid gap-1 sm:text-right">
              <p className="stat-label">Latest IEX trade</p>
              <p className="text-3xl font-bold tabular-nums">
                {price == null ? "-" : formatMoney(price)}
              </p>
              {periodChange !== null ? (
                <p className="sm:justify-self-end">
                  <Delta value={periodChange} pct={periodChangePct} />
                  <span className="ml-1 text-xs text-faint">over {range}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Period high" value={formatMoney(periodHigh)} />
          <MiniStat label="Period low" value={formatMoney(periodLow)} />
          <MiniStat label="Latest close" value={formatMoney(lastClose)} />
          <MiniStat label="Latest volume" value={formatNumber(bars.at(-1)?.volume)} />
        </section>

        <section className="card grid gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2>{range} daily closes</h2>
              <p className="text-sm text-muted">
                Adjusted bars from{" "}
                <span className="mono text-ink">marketData.getStockBarsFor()</span>.
              </p>
            </div>
            <RangeTabs symbol={asset.symbol} active={range} />
          </div>
          <PriceChart bars={bars} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card grid gap-4">
            <h2>Trading flags</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Flag label="Tradable" yes={asset.tradable} />
              <Flag label="Fractionable" yes={asset.fractionable} />
              <Flag label="Marginable" yes={asset.marginable} />
              <Flag label="Shortable" yes={asset.shortable} />
            </dl>
          </div>

          <div className="card grid gap-4">
            <h2>Reference data</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Exchange" value={asset.exchange} />
              <Field label="Status" value={humanize(asset.status)} />
              <Field label="Asset class" value={asset._class} />
              <Field label="Borrow status" value={humanize(asset.borrowStatus)} />
              <Field label="Long margin req." value={asset.marginRequirementLong} />
              <Field label="Short margin req." value={asset.marginRequirementShort} />
              <Field label="Asset id" value={asset.id} mono full />
            </dl>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="grid gap-6">
        <Link
          href="/stocks"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted no-underline transition hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={2.25} />
          Back to stocks
        </Link>
        <div className="alert">{describeAlpacaError(error)}</div>
      </div>
    );
  }
}

function RangeTabs({ symbol, active }: { symbol: string; active: RangeKey }) {
  return (
    <div className="inline-flex w-fit gap-1 rounded-full border border-line bg-surface-muted p-1">
      {(Object.keys(RANGES) as RangeKey[]).map((range) => (
        <Link
          key={range}
          href={`/stocks/${encodeURIComponent(symbol)}?range=${range}`}
          aria-current={range === active ? "true" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium no-underline transition ${
            range === active
              ? "bg-surface text-ink shadow-[var(--shadow-card)]"
              : "text-muted hover:text-ink"
          }`}
        >
          {range}
        </Link>
      ))}
    </div>
  );
}

function PriceChart({ bars }: { bars: Candle[] }) {
  if (bars.length < 2) {
    return <div className="notice">Not enough daily bars to draw a chart yet.</div>;
  }

  const width = 760;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 28, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const closes = bars.map((bar) => bar.close);
  const rawMin = Math.min(...closes);
  const rawMax = Math.max(...closes);
  const headroom = (rawMax - rawMin || rawMax || 1) * 0.08;
  const min = rawMin - headroom;
  const max = rawMax + headroom;
  const span = max - min || 1;

  // Hex literals mirror the design tokens in globals.css. SVG presentation
  // attributes do not evaluate CSS var(), so the values are inlined here.
  const LINE = "#e4e4e4";
  const FAINT = "#7a7a7a"; // gray-500
  const up = (bars.at(-1)?.close ?? 0) >= (bars[0]?.close ?? 0);
  const color = up ? "#059669" : "#d73939"; // emerald-600 / red-600

  const x = (index: number) => pad.left + (index / (bars.length - 1)) * innerW;
  const y = (value: number) => pad.top + (1 - (value - min) / span) * innerH;

  const linePath = bars
    .map((bar, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(bar.close).toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(bars.length - 1).toFixed(2)} ${pad.top + innerH} L ${x(0).toFixed(2)} ${pad.top + innerH} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => rawMin + ((rawMax - rawMin) * i) / ticks);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Daily close price chart"
    >
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((value) => (
        <g key={value}>
          <line
            x1={pad.left}
            y1={y(value)}
            x2={width - pad.right}
            y2={y(value)}
            stroke={LINE}
            strokeWidth={1}
          />
          <text
            x={pad.left - 8}
            y={y(value)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill={FAINT}
          >
            {formatMoney(value)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#area-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <text x={pad.left} y={height - 6} fontSize={11} fill={FAINT} textAnchor="start">
        {formatDate(bars[0]?.timestamp)}
      </text>
      <text x={width - pad.right} y={height - 6} fontSize={11} fill={FAINT} textAnchor="end">
        {formatDate(bars.at(-1)?.timestamp)}
      </text>
    </svg>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card grid gap-1.5">
      <p className="stat-label">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Flag({ label, yes }: { label: string; yes: boolean }) {
  return (
    <div className="grid gap-1.5">
      <dt className="stat-label">{label}</dt>
      <dd>
        <span className={`badge ${yes ? "badge-positive" : ""}`}>{yes ? "Yes" : "No"}</span>
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`grid gap-1 ${full ? "col-span-2" : ""}`}>
      <dt className="stat-label">{label}</dt>
      <dd className={mono ? "mono break-all text-sm" : "text-sm font-medium"}>
        {value ?? "-"}
      </dd>
    </div>
  );
}
