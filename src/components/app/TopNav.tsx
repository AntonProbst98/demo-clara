"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePromises } from "@/components/providers/PromisesProvider";

const LINKS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/dashboard", label: "Daily Progress" },
  { href: "/import", label: "Import" },
];

export function TopNav() {
  const pathname = usePathname();
  const { promises } = usePromises();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="flex h-14 items-center gap-6 px-5">
        <Link href="/workspace" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Collections Copilot
          </span>
          <span className="hidden rounded border border-[var(--line-strong)] px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted sm:inline">
            Clara · Internal
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--neutral-wash)] text-ink"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-[12px] text-ink-secondary md:flex">
            <span className="tnum font-semibold text-ink">{promises.length}</span>
            {promises.length === 1 ? "promise" : "promises"} logged today
          </span>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[13px] font-bold text-[var(--accent-ink)]"
      style={{ background: "var(--accent)" }}
    >
      C
    </span>
  );
}
