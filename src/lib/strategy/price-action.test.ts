import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, DEFAULT_STRATEGY, createPaperAccount } from "../bot/defaults";
import type { Candle, ChartLevel } from "../bot/types";
import { paperFill, markToMarket } from "../bot/paper";
import { priceMovePctFromRoe, sizeFromMargin, sizeFromRisk, stopTakeFromRoe } from "./risk";
import { formatClock, parseClock, sessionStatus } from "./session";
import { bearishEngulfing, bullishEngulfing, evaluatePriceAction } from "./price-action";

function bar(i: number, o: number, h: number, l: number, c: number): Candle {
  return {
    t: i * 300_000,
    T: i * 300_000 + 299_999,
    s: "BTC",
    i: "5m",
    o,
    h,
    l,
    c,
    v: 10,
    n: 4,
  };
}

const OPEN = Date.UTC(2026, 8, 4, 13, 30, 0);

function sessionBar(offsetMin: number, o: number, h: number, l: number, c: number, coin = "BTC"): Candle {
  const t = OPEN + offsetMin * 60_000;
  return { t, T: t + 299_999, s: coin, i: "5m", o, h, l, c, v: 8, n: 3 };
}

function resistance(overrides: Partial<ChartLevel> = {}): ChartLevel {
  return {
    id: "r1",
    coin: "BTC",
    kind: "resistance",
    price: 100,
    note: "",
    createdAt: 0,
    sessionDate: "2026-09-04",
    ...overrides,
  };
}

describe("session clock", () => {
  it("parses and formats HH:MM", () => {
    assert.equal(parseClock("09:30"), 570);
    assert.equal(formatClock(570), "09:30");
    assert.equal(formatClock(16 * 60), "16:00");
  });

  it("treats a weekday 10:00 ET stamp as in session", () => {
    const ts = Date.UTC(2026, 8, 4, 14, 0, 0);
    const status = sessionStatus(ts, DEFAULT_STRATEGY);
    assert.equal(status.inSession, true);
    assert.equal(status.dateKey, "2026-09-04");
  });

  it("treats 08:00 ET as premarket", () => {
    const ts = Date.UTC(2026, 8, 4, 12, 0, 0);
    const status = sessionStatus(ts, DEFAULT_STRATEGY);
    assert.equal(status.inSession, false);
    assert.match(status.label, /Premarket/);
  });
});

describe("engulfing", () => {
  it("detects a bullish engulfing continuation", () => {
    const prev = bar(0, 101, 101.2, 99.8, 100);
    const curr = bar(1, 99.9, 102.2, 99.7, 102);
    assert.equal(bullishEngulfing(prev, curr), true);
    assert.equal(bearishEngulfing(prev, curr), false);
  });
});

describe("price action sequence", () => {
  it("goes long after break, a few consolidation bars, then bullish engulfing", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1), // break
      sessionBar(10, 101.0, 101.6, 100.6, 101.2), // pause 1 — no tag required
      sessionBar(15, 101.1, 101.4, 100.7, 100.9), // pause 2
      sessionBar(20, 100.9, 101.0, 100.4, 100.5), // pause 3, small bearish
      sessionBar(25, 100.4, 102.6, 100.3, 102.3), // bullish engulfing
    ];
    const now = OPEN + 30 * 60_000;
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now,
    });
    assert.equal(setups[0]?.phase, "filled");
    assert.equal(signal.action, "long");
  });

  it("does not enter on the first bars after the break", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1),
      sessionBar(10, 101.0, 101.1, 100.4, 100.5),
      sessionBar(15, 100.4, 102.6, 100.3, 102.3),
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now: OPEN + 20 * 60_000,
    });
    assert.notEqual(signal.action, "long");
    assert.equal(setups[0]?.phase, "broken");
  });

  it("invalidates the level if a 5m close comes back through it", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1),
      sessionBar(10, 101.0, 101.2, 99.4, 99.6), // close back below
      sessionBar(15, 99.6, 99.7, 99.2, 99.3),
      sessionBar(20, 99.2, 99.4, 99.0, 99.1),
      sessionBar(25, 99.0, 102.4, 98.9, 102.1),
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now: OPEN + 30 * 60_000,
    });
    assert.equal(setups[0]?.phase, "failed");
    assert.equal(signal.action, "hold");
    assert.match(setups[0]?.detail ?? "", /Invalidated/);
  });

  it("only watches a newly charted level from the moment it is added", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1),
      sessionBar(10, 101.0, 101.2, 99.4, 99.6),
      sessionBar(15, 99.8, 100.2, 99.5, 99.9),
      sessionBar(20, 99.9, 100.4, 99.7, 99.95),
    ];
    const addedAt = OPEN + 18 * 60_000;
    const { setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance({ createdAt: addedAt })],
      config: DEFAULT_STRATEGY,
      now: OPEN + 25 * 60_000,
    });
    assert.equal(setups[0]?.phase, "watching");
  });

  it("does not enter outside the New York session", () => {
    const candles = [bar(1, 99, 101, 98, 101)];
    const { signal } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now: Date.UTC(2026, 8, 4, 12, 0, 0),
    });
    assert.equal(signal.action, "hold");
    assert.match(signal.reason, /Premarket|session/i);
  });
});

describe("risk sizing", () => {
  it("uses 70% of equity as margin times leverage", () => {
    const sized = sizeFromMargin({
      equity: 1000,
      price: 50,
      leverage: 10,
      config: DEFAULT_CONFIG,
    });
    assert.equal(sized.margin, 700);
    assert.equal(sized.notional, 7000);
    assert.equal(sized.size, 140);
  });

  it("places a 5% ROE stop as 0.5% of price at 10x", () => {
    assert.equal(priceMovePctFromRoe(5, 10), 0.5);
    assert.equal(priceMovePctFromRoe(10, 10), 1);
    const levels = stopTakeFromRoe("long", 100, 10, DEFAULT_STRATEGY);
    assert.equal(levels.stopPrice, 99.5);
    assert.equal(levels.takePrice, 101);
  });

  it("sizeFromRisk follows the margin model", () => {
    const sized = sizeFromRisk({
      equity: 1000,
      price: 100,
      atr: 1,
      config: DEFAULT_CONFIG,
    });
    assert.equal(sized.notional, 7000);
  });
});

describe("paper broker", () => {
  it("realizes a long profit after a close", () => {
    const paper = createPaperAccount(10_000);
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
    const positions = opened.position ? [opened.position] : [];
    markToMarket(paper, positions, { ETH: 110 });
    const closed = paperFill({
      paper,
      positions,
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
