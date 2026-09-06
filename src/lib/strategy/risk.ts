import type { BotConfig, Position, Side, StrategyConfig } from "../bot/types";

export function priceMovePctFromRoe(roePct: number, leverage: number): number {
  return roePct / Math.max(leverage, 1);
}

export function roeFromPriceMove(pricePct: number, leverage: number): number {
  return pricePct * Math.max(leverage, 1);
}

export function stopTakeFromPrice(side: Side, entry: number, config: StrategyConfig) {
  const stopPct = config.stopLossPricePct / 100;
  const takePct = config.takeProfitPricePct / 100;
  if (side === "long") {
    return { stopPrice: entry * (1 - stopPct), takePrice: entry * (1 + takePct) };
  }
  return { stopPrice: entry * (1 + stopPct), takePrice: entry * (1 - takePct) };
}

/** @deprecated price stops are leverage-independent; kept for call sites that still pass leverage */
export function stopTakeFromRoe(side: Side, entry: number, _leverage: number, config: StrategyConfig) {
  return stopTakeFromPrice(side, entry, config);
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
  const stopPct = args.config.strategy.stopLossPricePct / 100;
  return {
    size: sized.size,
    stopDistance: args.price * stopPct,
    notional: sized.notional,
  };
}

export function stopTakePrices(side: Side, entry: number, _atr: number, config: BotConfig) {
  return stopTakeFromPrice(side, entry, config.strategy);
}

export function hitStop(position: Position, mark: number): boolean {
  return position.side === "long" ? mark <= position.stopPrice : mark >= position.stopPrice;
}

export function hitTake(position: Position, mark: number): boolean {
  return position.side === "long" ? mark >= position.takePrice : mark <= position.takePrice;
}

export function favorablePriceMovePct(
  position: Pick<Position, "side" | "entryPrice">,
  mark: number,
): number {
  if (position.entryPrice <= 0) return 0;
  const raw =
    position.side === "long"
      ? (mark - position.entryPrice) / position.entryPrice
      : (position.entryPrice - mark) / position.entryPrice;
  return Math.max(0, raw * 100);
}

function reachedPriceMove(position: Pick<Position, "side" | "entryPrice">, mark: number, pricePct: number): boolean {
  const need = (pricePct / 100) * position.entryPrice;
  const move =
    position.side === "long" ? mark - position.entryPrice : position.entryPrice - mark;
  return move + 1e-12 >= need;
}

export function shouldMoveStopToBreakEven(position: Position, mark: number, config: StrategyConfig): boolean {
  if (position.breakEvenStop) return false;
  return reachedPriceMove(position, mark, config.breakEvenPricePct);
}

export function moveStopToBreakEven(position: Position): void {
  position.stopPrice = position.entryPrice;
  position.breakEvenStop = true;
}

export function shouldArmGiveUp(position: Position, mark: number, config: StrategyConfig): boolean {
  if (position.giveUpArmedBarTime != null) return false;
  return reachedPriceMove(position, mark, config.giveUpPricePct);
}

export function closedBarsAfter(barTimes: number[], armedBarTime: number): number {
  return barTimes.filter((t) => t > armedBarTime).length;
}

export function shouldGiveUp(
  position: Position,
  closedBarTimes: number[],
  config: StrategyConfig,
): boolean {
  if (position.giveUpArmedBarTime == null) return false;
  const wait = Math.max(1, Math.round(config.giveUpBars));
  return closedBarsAfter(closedBarTimes, position.giveUpArmedBarTime) >= wait;
}

export function closedBackThroughLevel(
  position: Pick<Position, "side" | "levelPrice" | "entryBarTime">,
  candles: Array<{ t: number; c: number }>,
  config: StrategyConfig,
): boolean {
  if (!config.flattenOnLevelFail) return false;
  if (position.levelPrice == null || !Number.isFinite(position.levelPrice) || position.levelPrice <= 0) {
    return false;
  }
  for (const candle of candles) {
    if (position.entryBarTime != null && candle.t <= position.entryBarTime) continue;
    if (position.side === "long" && candle.c < position.levelPrice) return true;
    if (position.side === "short" && candle.c > position.levelPrice) return true;
  }
  return false;
}

export function unrealized(position: Pick<Position, "side" | "size" | "entryPrice">, mark: number): number {
  const dir = position.side === "long" ? 1 : -1;
  return (mark - position.entryPrice) * position.size * dir;
}
