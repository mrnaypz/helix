import type { Candle, Position, Signal, StrategyConfig } from "../bot/types";
import { atr, crossedOver, crossedUnder, ema } from "./indicators";

export function evaluateEmaCrossover(args: {
  coin: string;
  candles: Candle[];
  position: Position | undefined;
  config: StrategyConfig;
}): Signal {
  const { coin, candles, position, config } = args;
  const closes = candles.map((c) => c.c);
  const fastSeries = ema(closes, config.fastEma);
  const slowSeries = ema(closes, config.slowEma);
  const atrSeries = atr(candles, config.atrPeriod);

  const i = candles.length - 1;
  const prev = i - 1;
  const fast = fastSeries[i];
  const slow = slowSeries[i];
  const prevFast = fastSeries[prev];
  const prevSlow = slowSeries[prev];
  const atrValue = atrSeries[i];
  const close = candles[i].c;
  const barTime = candles[i].t;

  const base = {
    coin,
    fastEma: fast,
    slowEma: slow,
    atr: atrValue,
    close,
    barTime,
  };

  if (![fast, slow, prevFast, prevSlow, atrValue].every(Number.isFinite)) {
    return { ...base, action: "hold", reason: "Warming up indicators" };
  }

  const longCross = crossedOver(prevFast, prevSlow, fast, slow);
  const shortCross = crossedUnder(prevFast, prevSlow, fast, slow);
  const upTrend = close > slow;
  const downTrend = close < slow;

  if (position) {
    if (position.side === "long" && shortCross) {
      return { ...base, action: "flat", reason: "Fast EMA crossed below slow — exit long" };
    }
    if (position.side === "short" && longCross) {
      return { ...base, action: "flat", reason: "Fast EMA crossed above slow — exit short" };
    }
    return { ...base, action: "hold", reason: "Hold: trend still intact" };
  }

  if (longCross && (!config.trendFilter || upTrend)) {
    return { ...base, action: "long", reason: "Fast EMA crossed above slow" };
  }
  if (config.allowShort && shortCross && (!config.trendFilter || downTrend)) {
    return { ...base, action: "short", reason: "Fast EMA crossed below slow" };
  }

  return { ...base, action: "hold", reason: "No crossover on the last closed bar" };
}
