import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { formatPercent, formatSignedMoney, type Tone, toneOf } from "@/lib/format";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-muted",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card card-interactive grid gap-2">
      <div className="flex items-center justify-between">
        <p className="stat-label">{label}</p>
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-muted text-muted">
            <Icon size={16} strokeWidth={2.25} />
          </span>
        ) : null}
      </div>
      <p className={`stat-value ${TONE_TEXT[tone]}`}>{value}</p>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/**
 * Signed currency change with an optional percent and directional arrow.
 * `pct` is a decimal fraction (e.g. 0.0523 renders as "+5.23%").
 */
export function Delta({
  value,
  pct,
}: {
  value: string | number | null | undefined;
  pct?: string | number | null | undefined;
}) {
  const tone = toneOf(value);
  const Icon = tone === "negative" ? ArrowDownRight : ArrowUpRight;

  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
      {tone !== "neutral" ? <Icon size={14} strokeWidth={2.5} /> : null}
      <span>{formatSignedMoney(value)}</span>
      {pct !== undefined && pct !== null ? (
        <span className="text-faint">({formatPercent(pct)})</span>
      ) : null}
    </span>
  );
}

export function ToneValue({
  value,
  children,
}: {
  value: string | number | null | undefined;
  children: ReactNode;
}) {
  return <span className={`tabular-nums ${TONE_TEXT[toneOf(value)]}`}>{children}</span>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-muted text-muted">
        <Icon size={22} strokeWidth={2} />
      </span>
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Configuration" title={title} />
      <div className="alert">{message}</div>
    </div>
  );
}
