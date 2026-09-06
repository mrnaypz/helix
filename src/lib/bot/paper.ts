import type { Fill, PaperAccount, Position, Side, StrategyConfig } from "./types";
import { unrealized } from "../strategy/risk";

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function markToMarket(paper: PaperAccount, positions: Position[], marks: Record<string, number>) {
  let unreal = 0;
  for (const pos of positions) {
    const mark = marks[pos.coin] ?? pos.markPrice;
    pos.markPrice = mark;
    pos.notional = pos.size * mark;
    pos.unrealizedPnl = unrealized(pos, mark);
    unreal += pos.unrealizedPnl;
  }
  paper.unrealizedPnl = unreal;
  paper.equity = paper.cash + unreal;
}

export function paperFill(args: {
  paper: PaperAccount;
  positions: Position[];
  coin: string;
  side: Side;
  action: "open" | "close";
  reason: string;
  size: number;
  mark: number;
  stopPrice?: number;
  takePrice?: number;
  leverage: number;
  atrAtEntry?: number;
  levelPrice?: number | null;
  entryBarTime?: number | null;
  strategy: StrategyConfig;
  mode?: "paper" | "live";
}): { fill: Fill; position: Position | null } {
  const slip = args.mark * (args.strategy.slippageBps / 10_000);
  const price =
    args.action === "open"
      ? args.side === "long"
        ? args.mark + slip
        : args.mark - slip
      : args.side === "long"
        ? args.mark - slip
        : args.mark + slip;
  const fee = price * args.size * (args.strategy.takerFeeBps / 10_000);
  args.paper.feesPaid += fee;

  let pnl = 0;
  let remaining: Position | null = null;

  if (args.action === "open") {
    args.paper.cash -= fee;
    remaining = {
      coin: args.coin,
      side: args.side,
      size: args.size,
      entryPrice: price,
      markPrice: args.mark,
      stopPrice: args.stopPrice ?? price,
      takePrice: args.takePrice ?? price,
      leverage: args.leverage,
      notional: args.size * args.mark,
      unrealizedPnl: 0,
      openedAt: Date.now(),
      atrAtEntry: args.atrAtEntry ?? 0,
      breakEvenStop: false,
      giveUpArmedBarTime: null,
      levelPrice: args.levelPrice ?? null,
      entryBarTime: args.entryBarTime ?? null,
    };
  } else {
    const existing = args.positions.find((p) => p.coin === args.coin);
    if (existing) {
      pnl = unrealized(existing, price) - fee;
      args.paper.cash += pnl;
      args.paper.realizedPnl += pnl;
    } else {
      args.paper.cash -= fee;
    }
  }

  const fill: Fill = {
    id: id("fill"),
    ts: Date.now(),
    coin: args.coin,
    side: args.side,
    action: args.action,
    reason: args.reason,
    size: args.size,
    price,
    fee,
    pnl,
    mode: args.mode ?? "paper",
  };

  return { fill, position: remaining };
}
