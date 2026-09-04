import type { BotConfig, Position, Side, StrategyConfig } from "../bot/types";

export function priceMovePctFromRoe(roePct: number, leverage: number): number {
  return roePct / Math.max(leverage, 1);
}

export function stopTakeFromRoe(side: Side, entry: number, leverage: number, config: StrategyConfig) {
  const stopPct = priceMovePctFromRoe(config.stopLossRoePct, leverage) / 100;
  const takePct = priceMovePctFromRoe(config.takeProfitRoePct, leverage) / 100;
  if (side === "long") {
    return { stopPrice: entry * (1 - stopPct), takePrice: entry * (1 + takePct) };
  }
  return { stopPrice: entry * (1 + stopPct), takePrice: entry * (1 - takePct) };
}

export function sizeFromMargin(args: {
  equity: number;
  price: number;
  leverage: number;
  config: BotConfig;
}): { size: number; margin: number; notional: number } {
  const { equity, price, config } = args;
  const leverage = Math.max(args.leverage, 1);
  const marginPct = Math.min(Math.max(config.strategy.marginPct, 0), 100);
  const margin = equity * (marginPct / 100);
  if (price <= 0 || margin <= 0) {
    return { size: 0, margin, notional: 0 };
  }
  const notional = margin * leverage;
  return { size: notional / price, margin, notional };
}

export function sizeFromRisk(args: {
  equity: number;
  price: number;
  atr: number;
  config: BotConfig;
  stopDistance?: number;
}): { size: number; stopDistance: number; notional: number } {
  const sized = sizeFromMargin({
    equity: args.equity,
    price: args.price,
    leverage: args.config.strategy.maxLeverage,
    config: args.config,
  });
  const stopPct = priceMovePctFromRoe(args.config.strategy.stopLossRoePct, args.config.strategy.maxLeverage) / 100;
  return {
    size: sized.size,
    stopDistance: args.price * stopPct,
    notional: sized.notional,
  };
}

export function stopTakePrices(side: Side, entry: number, _atr: number, config: BotConfig) {
  return stopTakeFromRoe(side, entry, config.strategy.maxLeverage, config.strategy);
}

export function hitStop(position: Position, mark: number): boolean {
  return position.side === "long" ? mark <= position.stopPrice : mark >= position.stopPrice;
}

export function hitTake(position: Position, mark: number): boolean {
  return position.side === "long" ? mark >= position.takePrice : mark <= position.takePrice;
}

export function unrealized(position: Pick<Position, "side" | "size" | "entryPrice">, mark: number): number {
  const dir = position.side === "long" ? 1 : -1;
  return (mark - position.entryPrice) * position.size * dir;
}
