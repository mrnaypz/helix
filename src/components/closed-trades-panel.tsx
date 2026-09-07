"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ClosedTradeTicket } from "@/components/trade-tickets";
import type { BotState, Position } from "@/lib/bot/types";
import { visibleClosedTrades } from "@/lib/bot/trades";

export function ClosedTradesPanel({
  state,
  nowMs,
  limit = 8,
}: {
  state: BotState;
  nowMs: number | null;
  limit?: number;
}) {
  const trades = visibleClosedTrades(state);
  const open: Position[] = state.positions ?? [];
  const fillCount = state.fills?.length ?? 0;

  return (
    <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Closed trades</h2>
          <p className="text-sm text-muted-foreground">
            {trades.length
              ? `${trades.length} close${trades.length === 1 ? "" : "s"} in this book.`
              : "Recaps live here after a flatten."}{" "}
            <Link href="/trades" className="text-emerald-300 underline-offset-2 hover:underline">
              Open the Trades page
            </Link>
          </p>
        </div>
      </div>
      {trades.length ? (
        trades.slice(0, limit).map((trade) => <ClosedTradeTicket key={trade.id} trade={trade} nowMs={nowMs} />)
      ) : (
        <Card>
          <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
            {open.length ? (
              <p>
                {open[0]?.coin} {open[0]?.side} is still open. The recap appears the moment it hits stop, target,
                level-fail, session close, or kill switch.
              </p>
            ) : fillCount > 0 ? (
              <p>
                This book has {fillCount} fill{fillCount === 1 ? "" : "s"} but no close yet. If you already flattened
                elsewhere, you are looking at a different <code>data/bot-state.json</code>.
              </p>
            ) : (
              <p>
                No fills in this book. If you traded today, Helix is reading a different folder than the one that took
                the trade. Check you started <code>npm run dev</code> in the same Ubuntu directory you always use.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
