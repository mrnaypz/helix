"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClosedTrade, Position } from "@/lib/bot/types";
import { clsxPositive, formatDuration, formatNyTime, formatPx, money, pct, relativeTimeLabel, signedMoney } from "@/lib/format";
import { cn } from "cn";

export function OpenPositionTicket({ position: p, nowMs }: { position: Position; nowMs: number | null }) {
  const margin = p.leverage > 0 ? p.notional / p.leverage : 0;
  const roe = margin > 0 ? (p.unrealizedPnl / margin) * 100 : 0;
  const move =
    p.entryPrice > 0
      ? ((p.side === "long" ? p.markPrice - p.entryPrice : p.entryPrice - p.markPrice) / p.entryPrice) * 100
      : 0;
  const toStop =
    p.entryPrice > 0
      ? ((p.side === "long" ? p.stopPrice - p.entryPrice : p.entryPrice - p.stopPrice) / p.entryPrice) * 100
      : 0;
  const toTake =
    p.entryPrice > 0
      ? ((p.side === "long" ? p.takePrice - p.entryPrice : p.entryPrice - p.takePrice) / p.entryPrice) * 100
      : 0;

  return (
    <Card className="border-white/15">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Open {p.coin}
              <span className={p.side === "long" ? "text-emerald-400" : "text-rose-400"}>{p.side}</span>
              <span className="text-sm font-normal text-muted-foreground">{p.leverage}x</span>
            </CardTitle>
            <CardDescription>
              {p.breakEvenStop ? "Stop is at break-even. " : ""}
              {p.giveUpArmedBarTime != null ? "Give-up clock is armed. " : ""}
              Kill switch flattens this trade. Remove on the level does not.
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Opened {relativeTimeLabel(p.openedAt, nowMs)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <TicketField label="Size" value={(p.size || 0).toPrecision(6)} hint={`Notional ${money(p.notional)}`} />
        <TicketField label="Entry" value={formatPx(p.entryPrice)} hint={`Mark ${formatPx(p.markPrice)}`} />
        <TicketField
          label="Unrealized"
          value={signedMoney(p.unrealizedPnl)}
          hint={`${pct(move)} price · ${pct(roe)} ROE`}
          tone={p.unrealizedPnl}
        />
        <TicketField label="Margin" value={money(margin)} hint="70% of equity at 10x" />
        <TicketField
          label="Stop"
          value={formatPx(p.stopPrice)}
          hint={`${pct(toStop)} from entry${p.breakEvenStop ? " · BE" : ""}`}
        />
        <TicketField label="Take profit" value={formatPx(p.takePrice)} hint={`${pct(toTake)} from entry`} />
        <TicketField
          label="Charted level"
          value={p.levelPrice != null ? formatPx(p.levelPrice) : "—"}
          hint="5m close back through this flattens"
        />
        <TicketField
          label="Distance to mark"
          value={pct(move)}
          hint={p.side === "long" ? "Mark vs entry" : "Entry vs mark (short)"}
          tone={move}
        />
      </CardContent>
    </Card>
  );
}

export function ClosedTradeTicket({ trade: t, nowMs }: { trade: ClosedTrade; nowMs: number | null }) {
  const held = (t.closedAt ?? 0) - (t.openedAt ?? 0);
  return (
    <Card className="border-emerald-500/20">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Closed {t.coin}
              <span className={t.side === "long" ? "text-emerald-400" : "text-rose-400"}>{t.side}</span>
              <span className="text-sm font-normal text-muted-foreground">{t.leverage}x</span>
              <span className={cn("text-sm font-normal", clsxPositive(t.realizedPnl))}>
                {signedMoney(t.realizedPnl)}
              </span>
            </CardTitle>
            <CardDescription>
              {t.reason || "Closed"}
              {t.breakEvenStop ? " · stop had moved to break-even" : ""}
              {!t.complete ? " · rebuilt from fills (stop, target, and level were not stored)" : ""}
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {formatNyTime(t.openedAt)} → {formatNyTime(t.closedAt)} · {formatDuration(held)} ·{" "}
            {relativeTimeLabel(t.closedAt, nowMs)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <TicketField label="Size" value={(t.size || 0).toPrecision(6)} hint={`Notional ${money(t.notional)}`} />
        <TicketField label="Entry" value={t.entryPrice ? formatPx(t.entryPrice) : "—"} hint={`Exit ${formatPx(t.exitPrice)}`} />
        <TicketField
          label="Realized"
          value={signedMoney(t.realizedPnl)}
          hint={`${pct(t.priceMovePct)} price · ${pct(t.roePct)} ROE · fee ${money(t.fee)}`}
          tone={t.realizedPnl}
        />
        <TicketField label="Margin" value={money(t.margin)} hint={`${t.leverage}x`} />
        <TicketField
          label="Stop"
          value={t.stopPrice != null ? formatPx(t.stopPrice) : "—"}
          hint={t.stopPct != null ? `${pct(t.stopPct)} from entry${t.breakEvenStop ? " · BE" : ""}` : "Not stored"}
        />
        <TicketField
          label="Take profit"
          value={t.takePrice != null ? formatPx(t.takePrice) : "—"}
          hint={t.takePct != null ? `${pct(t.takePct)} from entry` : "Not stored"}
        />
        <TicketField
          label="Charted level"
          value={t.levelPrice != null ? formatPx(t.levelPrice) : "—"}
          hint={t.complete ? "Level used for the failed-level exit" : "Not stored on this close"}
        />
        <TicketField
          label="Price move"
          value={pct(t.priceMovePct)}
          hint="Entry to exit, signed for the side"
          tone={t.priceMovePct}
        />
      </CardContent>
    </Card>
  );
}

function TicketField({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: number;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-lg font-medium", tone !== undefined && clsxPositive(tone))}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
