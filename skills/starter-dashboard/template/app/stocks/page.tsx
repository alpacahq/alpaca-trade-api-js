import { Check, Minus, Search, SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui";
import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";

export const dynamic = "force-dynamic";

const MAX_ROWS = 75;

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function StocksPage({ searchParams }: PageProps) {
  const query = (await searchParams)?.q?.trim() ?? "";

  try {
    const assets = await getAlpaca().trading.assets.getV2Assets({
      status: "active",
      assetClass: "us_equity",
    });

    const needle = query.toLowerCase();
    const tradable = assets.filter((asset) => asset.tradable);
    const rows = tradable
      .filter((asset) => {
        if (!needle) return true;
        return (
          asset.symbol.toLowerCase().includes(needle) ||
          asset.name.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .slice(0, MAX_ROWS);

    return (
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Trading API"
          title="Stocks"
          description={
            <>
              Active, tradable US equities from{" "}
              <span className="mono text-ink">trading.assets.getV2Assets()</span>.
            </>
          }
        />

        <form action="/stocks" className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Search by symbol or company - AAPL, MSFT, Tesla..."
              autoComplete="off"
              aria-label="Search symbol or company"
              className="input pl-10"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            <Search size={16} strokeWidth={2.5} />
            Search
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Showing <span className="font-semibold text-ink">{rows.length}</span>
            {query ? (
              <>
                {" "}
                of {tradable.length} for{" "}
                <span className="font-semibold text-ink">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              <> tradable stocks (max {MAX_ROWS})</>
            )}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={SearchX}
              title="No matching tradable stocks"
              description="Try a different symbol or company name."
            />
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Exchange</th>
                    <th>Fractionable</th>
                    <th>Shortable</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <Link
                          className="mono font-semibold text-accent no-underline hover:underline"
                          href={`/stocks/${encodeURIComponent(asset.symbol)}`}
                        >
                          {asset.symbol}
                        </Link>
                      </td>
                      <td className="font-medium">{asset.name}</td>
                      <td className="text-muted">{asset.exchange}</td>
                      <td>
                        <Flag yes={asset.fractionable} />
                      </td>
                      <td>
                        <Flag yes={asset.shortable} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="grid gap-6">
        <PageHeader eyebrow="Trading API" title="Stocks" />
        <div className="alert">{describeAlpacaError(error)}</div>
      </div>
    );
  }
}

function Flag({ yes }: { yes: boolean }) {
  return (
    <span className={`badge ${yes ? "badge-positive" : ""}`}>
      {yes ? <Check size={13} strokeWidth={2.5} /> : <Minus size={13} strokeWidth={2.5} />}
      {yes ? "Yes" : "No"}
    </span>
  );
}
