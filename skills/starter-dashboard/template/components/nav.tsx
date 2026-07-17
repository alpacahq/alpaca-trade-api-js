"use client";

import {
  ArrowLeftRight,
  CandlestickChart,
  LayoutDashboard,
  ScrollText,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stocks", label: "Stocks", icon: CandlestickChart },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/positions", label: "Positions", icon: Wallet },
  { href: "/orders", label: "Orders", icon: ScrollText },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ paper = true }: { paper?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-ink shadow-[var(--shadow-card)]">
            <TrendingUp size={18} strokeWidth={2.5} />
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:block">
            Alpaca Paper
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-1 items-center gap-1 overflow-x-auto"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium no-underline transition ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={2.25} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${paper ? "bg-positive" : "bg-negative"}`} />
          {paper ? "Paper" : "Live"}
        </span>
      </div>
    </header>
  );
}
