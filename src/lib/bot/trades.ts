import type { ClosedTrade, Fill, Position } from "./types";

export function snapshotClosedTrade(position: Position, fill: Fill): ClosedTrade {
  const entry = position.entryPrice;
  const exit = fill.price;
  const size = fill.size;
  const notional = size * entry;
  const leverage = Math.max(position.leverage, 1);
  const margin = notional / leverage;
  const move =
    entry > 0 ? ((position.side === "long" ? exit - entry : entry - exit) / entry) * 100 : 0;
  const roe = margin > 0 ? (fill.pnl / margin) * 100 : 0;
  const stopPct =
    entry > 0
      ? ((position.side === "long" ? position.stopPrice - entry : entry - position.stopPrice) / entry) * 100
      : 0;
  const takePct =
    entry > 0
      ? ((position.side === "long" ? position.takePrice - entry : entry - position.takePrice) / entry) * 100
      : 0;
  return {
    id: fill.id,
    openedAt: position.openedAt,
    closedAt: fill.ts,
    coin: position.coin,
    side: position.side,
    size,
    entryPrice: entry,
    exitPrice: exit,
    notional,
    margin,
    realizedPnl: fill.pnl,
    priceMovePct: move,
    roePct: roe,
    stopPrice: position.stopPrice,
    takePrice: position.takePrice,
    stopPct,
    takePct,
    levelPrice: position.levelPrice,
    leverage,
    fee: fill.fee,
    reason: fill.reason,
    breakEvenStop: position.breakEvenStop,
    mode: fill.mode,
    complete: true,
  };
}

export function closedTradesFromFills(fills: Fill[], leverage = 10): ClosedTrade[] {
  const chronological = [...fills].sort((a, b) => a.ts - b.ts || (a.action === "open" ? -1 : 1));
  const openStack: Fill[] = [];
  const out: ClosedTrade[] = [];
  for (const fill of chronological) {
    if (fill.action === "open") {
      openStack.push(fill);
      continue;
    }
    const openIdx = openStack.findLastIndex((o) => o.coin === fill.coin && o.side === fill.side);
    const open = openIdx >= 0 ? openStack.splice(openIdx, 1)[0] : undefined;
    const entry = open?.price ?? 0;
    const exit = fill.price;
    const size = fill.size;
    const notional = size * (entry || exit);
    const margin = notional / Math.max(leverage, 1);
    const move =
      entry > 0 ? ((fill.side === "long" ? exit - entry : entry - exit) / entry) * 100 : 0;
    const roe = margin > 0 ? (fill.pnl / margin) * 100 : 0;
    out.push({
      id: fill.id,
      openedAt: open?.ts ?? fill.ts,
      closedAt: fill.ts,
      coin: fill.coin,
      side: fill.side,
      size,
      entryPrice: entry,
      exitPrice: exit,
      notional,
      margin,
      realizedPnl: fill.pnl,
      priceMovePct: move,
      roePct: roe,
      stopPrice: null,
      takePrice: null,
      stopPct: null,
      takePct: null,
      levelPrice: null,
      leverage,
      fee: fill.fee,
      reason: fill.reason,
      breakEvenStop: false,
      mode: fill.mode,
      complete: false,
    });
  }
  return out.sort((a, b) => b.closedAt - a.closedAt);
}
