import { ArrowLeftRight, ScrollText } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";
import { formatDateTime, formatMoney, formatNumber, humanize } from "@/lib/format";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "open" | "closed";

const FILTERS: StatusFilter[] = ["all", "open", "closed"];
const OPEN_STATES = ["new", "accepted", "pending_new", "partially_filled"];

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

function normalizeStatus(value: string | undefined): StatusFilter {
  return value === "open" || value === "closed" || value === "all" ? value : "all";
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const status = normalizeStatus((await searchParams)?.status);

  try {
    const orders = await getAlpaca().trading.orders.getAllOrders({
      status,
      limit: 50,
      direction: "desc",
      nested: false,
    });

    const openCount = orders.filter((order) =>
      OPEN_STATES.includes(order.status ?? ""),
    ).length;
    const filledCount = orders.filter((order) => order.status === "filled").length;

    return (
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Trading API"
          title="Orders"
          description={
            <>
              Recent orders from{" "}
              <span className="mono text-ink">trading.orders.getAllOrders()</span>.
            </>
          }
          actions={
            <Link className="btn btn-primary" href="/trade">
              <ArrowLeftRight size={16} strokeWidth={2.5} />
              New order
            </Link>
          }
        />

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Returned orders" value={String(orders.length)} />
          <StatCard label="Open orders" value={String(openCount)} />
          <StatCard label="Filled" value={String(filledCount)} />
        </section>

        <div className="inline-flex w-fit gap-1 rounded-full border border-line bg-surface-muted p-1">
          {FILTERS.map((next) => (
            <Link
              key={next}
              href={`/orders?status=${next}`}
              aria-current={next === status ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize no-underline transition ${
                next === status
                  ? "bg-surface text-ink shadow-[var(--shadow-card)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {next}
            </Link>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={ScrollText}
              title="No orders to show"
              description="Submit a paper order and it will appear here."
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
                    <th>Type</th>
                    <th>Status</th>
                    <th className="num">Amount</th>
                    <th className="num">Limit</th>
                    <th className="num">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id ?? order.clientOrderId}>
                      <td className="mono font-semibold">{order.symbol ?? "-"}</td>
                      <td>
                        <span
                          className={`badge ${
                            order.side === "sell" ? "badge-negative" : ""
                          }`}
                        >
                          {humanize(order.side)}
                        </span>
                      </td>
                      <td className="text-muted">{humanize(order.type)}</td>
                      <td>
                        <span className={`badge ${statusBadge(order.status)}`}>
                          {humanize(order.status)}
                        </span>
                      </td>
                      <td className="num font-medium">
                        {describeAmount(order.qty, order.notional)}
                      </td>
                      <td className="num text-muted">{formatMoney(order.limitPrice)}</td>
                      <td className="num text-muted">{formatDateTime(order.submittedAt)}</td>
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
        <PageHeader eyebrow="Trading API" title="Orders" />
        <div className="alert">{describeAlpacaError(error)}</div>
      </div>
    );
  }
}

function describeAmount(
  qty: string | null | undefined,
  notional: string | null | undefined,
): string {
  if (qty) return `${formatNumber(qty)} sh`;
  if (notional) return formatMoney(notional);
  return "-";
}

function statusBadge(status: string | undefined): string {
  if (status === "filled") return "badge-positive";
  if (status === "rejected" || status === "canceled" || status === "expired") {
    return "badge-negative";
  }
  if (OPEN_STATES.includes(status ?? "")) return "badge-warning";
  return "";
}
