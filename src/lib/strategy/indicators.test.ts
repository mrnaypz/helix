import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossedOver, crossedUnder, ema } from "./indicators";
import { evaluateEmaCrossover } from "./ema-crossover";
import { sizeFromRisk } from "./risk";
import { DEFAULT_CONFIG, createPaperAccount } from "../bot/defaults";
import type { Candle } from "../bot/types";
import { paperFill, markToMarket } from "../bot/paper";

function candle(c: number, i: number): Candle {
  return {
    t: i * 60_000,
    T: i * 60_000 + 59_999,
    s: "BTC",
    i: "1m",
    o: c,
    h: c + 1,
    l: c - 1,
    c,
    v: 10,
    n: 3,
  };
}

describe("ema", () => {
  it("seeds with SMA then tracks price", () => {
    const values = [1, 2, 3, 4, 5, 6, 7];
    const series = ema(values, 3);
    assert.equal(series.length, 7);
    assert.ok(Number.isNaN(series[0]));
    assert.ok(Number.isNaN(series[1]));
    assert.equal(series[2], 2);
    assert.ok(series[6] > series[5]);
  });
});

describe("crossover", () => {
  it("detects a bullish cross", () => {
    assert.equal(crossedOver(1, 2, 3, 2), true);
    assert.equal(crossedOver(3, 2, 4, 2), false);
  });
  it("detects a bearish cross", () => {
    assert.equal(crossedUnder(3, 2, 1, 2), true);
    assert.equal(crossedUnder(1, 2, 0, 2), false);
  });
});

describe("ema strategy", () => {
  it("goes long after a fast/slow cross with rising closes", () => {
    const prices = [10, 10, 10, 10, 10, 10, 10, 12];
    const candles = prices.map(candle);
    const signal = evaluateEmaCrossover({
      coin: "BTC",
      candles,
      position: undefined,
      config: {
        ...DEFAULT_CONFIG.strategy,
        fastEma: 2,
        slowEma: 3,
        atrPeriod: 3,
        trendFilter: false,
      },
    });
    assert.equal(signal.action, "long");
  });
});

describe("risk sizing", () => {
  it("caps notional at max leverage", () => {
    const sized = sizeFromRisk({
      equity: 10_000,
      price: 100,
      atr: 0.01,
      config: {
        ...DEFAULT_CONFIG,
        strategy: { ...DEFAULT_CONFIG.strategy, atrStopMultiplier: 1, riskPctPerTrade: 50, maxLeverage: 2 },
      },
    });
    assert.ok(sized.notional <= 20_000 + 1e-6);
  });
});

describe("paper broker", () => {
  it("realizes a long profit after a close", () => {
    const paper = createPaperAccount(10_000);
    const positions: ReturnType<typeof paperFill>["position"][] = [];
    const opened = paperFill({
      paper,
      positions: [],
      coin: "ETH",
      side: "long",
      action: "open",
      reason: "test",
      size: 1,
      mark: 100,
      stopPrice: 90,
      takePrice: 120,
      leverage: 2,
      strategy: DEFAULT_CONFIG.strategy,
    });
    if (opened.position) positions.push(opened.position);
    markToMarket(paper, positions as never, { ETH: 110 });
    const closed = paperFill({
      paper,
      positions: positions as never,
      coin: "ETH",
      side: "long",
      action: "close",
      reason: "tp",
      size: 1,
      mark: 110,
      leverage: 2,
      strategy: { ...DEFAULT_CONFIG.strategy, slippageBps: 0, takerFeeBps: 0 },
    });
    assert.ok(closed.fill.pnl > 0);
  });
});
