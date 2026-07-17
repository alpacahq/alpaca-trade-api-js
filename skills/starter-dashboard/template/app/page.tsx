import {
  ArrowLeftRight,
  Banknote,
  CandlestickChart,
  ChevronRight,
  Gauge,
  PieChart,
  ScrollText,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { Delta, ErrorState, PageHeader, StatCard } from "@/components/ui";
import { describeAlpacaError, getAlpaca } from "@/lib/alpaca";
import { formatDate, formatMoney, humanize, parseNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const account = await getAlpaca().trading.account.getAccount();

    const equity = parseNumber(account.equity);
    const lastEquity = parseNumber(account.lastEquity);
    const todayChange =
      equity !== null && lastEquity !== null ? equity - lastEquity : null;
    const todayChangePct =
      todayChange !== null && lastEquity ? todayChange / lastEquity : null;
    const isActive = account.status === "ACTIVE";

    return (
      <div className="grid gap-8">
        <PageHeader
          eyebrow="Trading API"
          title="Paper trading dashboard"
          description="Account balances, status, and buying power from your Alpaca paper account."
          actions={
            <Link className="btn btn-primary" href="/trade">
              <ArrowLeftRight size={16} strokeWidth={2.5} />
              New order
            </Link>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Equity"
            value={formatMoney(account.equity)}
            icon={Wallet}
            hint={
              todayChange !== null ? (
                <span className="flex items-center gap-1.5">
                  <Delta value={todayChange} pct={todayChangePct} />
                  <span className="text-faint">today</span>
                </span>
              ) : null
            }
          />
          <StatCard
            label="Buying power"
            value={formatMoney(account.buyingPower)}
            icon={Gauge}
          />
          <StatCard label="Cash" value={formatMoney(account.cash)} icon={Banknote} />
          <StatCard
            label="Portfolio value"
            value={formatMoney(account.portfolioValue)}
            icon={PieChart}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="card grid gap-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <h2>Account</h2>
                <p className="text-sm text-muted">Identifiers and status.</p>
              </div>
              <span className={`badge ${isActive ? "badge-positive" : "badge-warning"}`}>
                {humanize(account.status)}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Account number" value={account.accountNumber} mono />
              <Field label="Account id" value={account.id} mono />
              <Field label="Currency" value={account.currency ?? "USD"} />
              <Field label="Day trades" value={String(account.daytradeCount ?? 0)} />
              <Field label="Created" value={formatDate(account.createdAt)} />
              <Field
                label="Pattern day trader"
                value={account.patternDayTrader ? "Yes" : "No"}
              />
            </dl>
          </div>

          <div className="card grid content-start gap-4 lg:col-span-2">
            <div>
              <h2>Starter flows</h2>
              <p className="text-sm text-muted">
                Common Trading and Market Data API workflows, each a direct SDK call.
              </p>
            </div>
            <div className="grid gap-2">
              <QuickLink href="/stocks" icon={CandlestickChart} label="Browse tradable stocks" />
              <QuickLink href="/trade" icon={ArrowLeftRight} label="Submit a paper order" />
              <QuickLink href="/orders" icon={ScrollText} label="Review recent orders" />
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Failed to load account" message={describeAlpacaError(error)} />;
  }
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <dt className="stat-label">{label}</dt>
      <dd className={mono ? "mono break-all text-sm" : "text-sm font-medium"}>
        {value ?? "-"}
      </dd>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[var(--radius-control)] border border-line px-3.5 py-3 text-sm font-medium no-underline transition hover:border-line-strong hover:bg-surface-muted"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight
        size={16}
        className="text-faint transition group-hover:translate-x-0.5 group-hover:text-muted"
      />
    </Link>
  );
}
