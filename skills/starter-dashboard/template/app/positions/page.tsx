import { ArrowLeftRight, PieChart, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { Delta, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";
import { formatMoney, formatNumber, parseNumber, toneOf } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  try {
    const positions = await getAlpaca().trading.positions.getAllOpenPositions();

    const totalMarketValue = positions.reduce(
      (sum, position) => sum + (parseNumber(position.marketValue) ?? 0),
      0,
    );
    const totalPl = positions.reduce(
      (sum, position) => sum + (parseNumber(position.unrealizedPl) ?? 0),
      0,
    );
    const totalCost = positions.reduce(
      (sum, position) => sum + (parseNumber(position.costBasis) ?? 0),
      0,
    );
    const totalPlPct = totalCost ? totalPl / totalCost : null;

    return (
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Trading API"
          title="Positions"
          description={
            <>
              Open paper positions from{" "}
              <span className="mono text-ink">trading.positions.getAllOpenPositions()</span>.
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open positions" value={String(positions.length)} icon={Wallet} />
          <StatCard label="Market value" value={formatMoney(totalMarketValue)} icon={PieChart} />
          <StatCard
            label="Unrealized P/L"
            value={formatMoney(totalPl)}
            icon={TrendingUp}
            tone={toneOf(totalPl)}
            hint={positions.length ? <Delta value={totalPl} pct={totalPlPct} /> : null}
          />
        </section>

        {positions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title="No open positions yet"
              description="Submit a paper order to start building a portfolio."
              action={
                <Link className="btn btn-secondary" href="/trade">
                  <ArrowLeftRight size={16} strokeWidth={2.25} />
                  Submit a paper order
                </Link>
              }
            />
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="num">Qty</th>
                    <th className="num">Avg entry</th>
                    <th className="num">Current</th>
                    <th className="num">Market value</th>
                    <th className="num">Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.assetId}>
                      <td>
                        <Link
                          className="mono font-semibold text-accent no-underline hover:underline"
                          href={`/stocks/${encodeURIComponent(position.symbol)}`}
                        >
                          {position.symbol}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            position.side === "short" ? "badge-negative" : ""
                          }`}
                        >
                          {position.side}
                        </span>
                      </td>
                      <td className="num">{formatNumber(position.qty)}</td>
                      <td className="num">{formatMoney(position.avgEntryPrice)}</td>
                      <td className="num">{formatMoney(position.currentPrice)}</td>
                      <td className="num font-medium">{formatMoney(position.marketValue)}</td>
                      <td className="num">
                        <Delta value={position.unrealizedPl} pct={position.unrealizedPlpc} />
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
        <PageHeader eyebrow="Trading API" title="Positions" />
        <div className="alert">{describeAlpacaError(error)}</div>
      </div>
    );
  }
}
