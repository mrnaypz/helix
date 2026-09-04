import type { BotConfig, Position, Side } from "../bot/types";

export function sizeFromRisk(args: {
  equity: number;
  price: number;
  atr: number;
  config: BotConfig;
}): { size: number; stopDistance: number; notional: number } {
  const { equity, price, atr, config } = args;
  const stopDistance = atr * config.strategy.atrStopMultiplier;
  if (stopDistance <= 0 || price <= 0) {
    return { size: 0, stopDistance, notional: 0 };
  }
  const riskAmount = equity * (config.strategy.riskPctPerTrade / 100);
  let size = riskAmount / stopDistance;
  const maxNotional = equity * config.strategy.maxLeverage;
  const notional = size * price;
  if (notional > maxNotional) {
    size = maxNotional / price;
  }
  return { size, stopDistance, notional: size * price };
}

export function stopTakePrices(side: Side, entry: number, atr: number, config: BotConfig) {
  const stopDist = atr * config.strategy.atrStopMultiplier;
  const takeDist = atr * config.strategy.atrTakeMultiplier;
  if (side === "long") {
    return { stopPrice: entry - stopDist, takePrice: entry + takeDist };
  }
  return { stopPrice: entry + stopDist, takePrice: entry - takeDist };
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
