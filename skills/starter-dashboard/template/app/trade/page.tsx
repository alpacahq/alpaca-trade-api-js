import { CheckCircle2, Info } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

import { submitOrder } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    ok?: string;
    error?: string;
    symbol?: string;
    status?: string;
    id?: string;
  }>;
};

export default async function TradePage({ searchParams }: PageProps) {
  const result = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Trading API"
        title="Trade"
        description={
          <>
            Submit paper market and limit orders with{" "}
            <span className="mono text-ink">trading.orders.market()</span> and{" "}
            <span className="mono text-ink">trading.orders.limit()</span>.
          </>
        }
      />

      {result?.ok ? (
        <div className="card flex flex-col gap-3 border-positive/25 bg-positive-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-positive" />
            <div className="grid gap-0.5">
              <p className="font-semibold text-positive">Order submitted</p>
              <p className="text-sm text-ink">
                {result.symbol ?? "Order"} is now {humanize(result.status)}.
              </p>
              {result.id ? <p className="mono text-xs text-muted">{result.id}</p> : null}
            </div>
          </div>
          <Link className="btn btn-secondary shrink-0" href="/orders">
            View orders
          </Link>
        </div>
      ) : null}

      {result?.error ? <div className="alert">{result.error}</div> : null}

      <form action={submitOrder} className="card grid max-w-2xl gap-6">
        <div className="field">
          <label className="label" htmlFor="symbol">
            Symbol
          </label>
          <input
            id="symbol"
            name="symbol"
            defaultValue={result?.symbol ?? "AAPL"}
            autoComplete="off"
            autoCapitalize="characters"
            className="input mono uppercase"
            required
          />
        </div>

        <div className="field">
          <span className="label">Side</span>
          <Segmented
            name="side"
            defaultValue="buy"
            options={[
              { value: "buy", label: "Buy", active: "peer-checked:bg-positive-soft peer-checked:text-positive" },
              { value: "sell", label: "Sell", active: "peer-checked:bg-negative-soft peer-checked:text-negative" },
            ]}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="field">
            <span className="label">Order type</span>
            <Segmented
              name="type"
              defaultValue="market"
              options={[
                { value: "market", label: "Market", active: "peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm" },
                { value: "limit", label: "Limit", active: "peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm" },
              ]}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="timeInForce">
              Time in force
            </label>
            <select id="timeInForce" name="timeInForce" defaultValue="day" className="input">
              <option value="day">Day</option>
              <option value="gtc">GTC</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="field">
            <label className="label" htmlFor="qty">
              Quantity
            </label>
            <input id="qty" name="qty" type="number" min="0" step="any" placeholder="1" className="input" />
          </div>

          <div className="field">
            <label className="label" htmlFor="notional">
              Notional USD
            </label>
            <input id="notional" name="notional" type="number" min="0" step="any" placeholder="250" className="input" />
          </div>

          <div className="field">
            <label className="label" htmlFor="limitPrice">
              Limit price
            </label>
            <input id="limitPrice" name="limitPrice" type="number" min="0" step="any" placeholder="175.50" className="input" />
          </div>
        </div>

        <div className="notice flex items-start gap-2.5">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            Market orders accept either quantity or notional. Limit orders require
            quantity and limit price.
          </span>
        </div>

        <button className="btn btn-primary w-full sm:w-fit" type="submit">
          Submit paper order
        </button>
      </form>
    </div>
  );
}

function Segmented({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string; active: string }[];
}) {
  return (
    <div
      className="grid gap-1 rounded-[var(--radius-control)] border border-line bg-surface-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            className="peer sr-only"
          />
          <span
            className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-muted transition ${option.active}`}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
