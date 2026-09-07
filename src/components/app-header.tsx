"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenIcon, CrosshairIcon, HistoryIcon, LayoutDashboardIcon, SlidersHorizontalIcon } from "lucide-react";
import { cn } from "cn";

const links = [
  { href: "/", label: "Desk", icon: LayoutDashboardIcon },
  { href: "/trades", label: "Trades", icon: HistoryIcon },
  { href: "/levels", label: "Levels", icon: CrosshairIcon },
  { href: "/strategy", label: "Rules", icon: SlidersHorizontalIcon },
  { href: "/runbook", label: "Runbook", icon: BookOpenIcon },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <>
      <header className="pointer-events-none sticky top-0 z-40 border-b border-white/8 bg-[#07080a]">
        <div className="pointer-events-auto mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-7 place-items-center rounded-md bg-emerald-400 text-[11px] font-semibold tracking-tight text-black">
              Hx
            </span>
            <span className="leading-none">
              <span className="block font-semibold tracking-tight">Helix</span>
              <span className="block text-[11px] text-muted-foreground">Hyperliquid desk</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-lg bg-white/5 p-1 md:flex">
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
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07080a] pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="pointer-events-auto grid grid-cols-5">
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                  active ? "text-emerald-300" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
