"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "Desk" },
  { href: "/levels", label: "Levels" },
  { href: "/strategy", label: "Rules" },
  { href: "/runbook", label: "Runbook" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07080a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-md bg-emerald-400 text-[11px] font-semibold tracking-tight text-black">
            Hx
          </span>
          <span className="leading-none">
            <span className="block font-semibold tracking-tight">Helix</span>
            <span className="block text-[11px] text-muted-foreground">Hyperliquid desk</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
