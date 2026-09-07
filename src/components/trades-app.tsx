"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ClosedTradesPanel } from "@/components/closed-trades-panel";
import { OpenPositionTicket } from "@/components/trade-tickets";
import type { PublicBotSnapshot } from "@/lib/bot/types";

function useClientNow() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const clock = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);
  return hydrated ? nowMs : null;
}

export function TradesApp({ initial }: { initial: PublicBotSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const nowMs = useClientNow();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/api/bot", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("Could not load trades");
          return res.json() as Promise<PublicBotSnapshot>;
        })
        .then((data) => {
          if (!cancelled) setSnap(data);
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const state = snap.state;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">History</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Trades</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Open position first, then every flatten in this book. This is the same data as Desk — a dedicated page so it
          cannot hide under the tape.
        </p>
      </div>
      {state.positions.map((p) => (
        <OpenPositionTicket key={p.coin} position={p} nowMs={nowMs} />
      ))}
      <ClosedTradesPanel state={state} nowMs={nowMs} limit={25} />
    </div>
  );
}
