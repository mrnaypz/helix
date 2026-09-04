import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, DEFAULT_STRATEGY, createPaperAccount } from "../bot/defaults";
import type { Candle, ChartLevel } from "../bot/types";
import { paperFill, markToMarket } from "../bot/paper";
import { sizeFromRisk } from "./risk";
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

describe("session clock", () => {
  it("parses and formats HH:MM", () => {
    assert.equal(parseClock("09:30"), 570);
    assert.equal(formatClock(570), "09:30");
    assert.equal(formatClock(16 * 60), "16:00");
  });

  it("treats a weekday 10:00 ET stamp as in session", () => {
    // 2026-09-04 14:00 UTC = 10:00 ET (EDT)
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
  it("goes long after break, pullback, then bullish engulfing", () => {
    const level: ChartLevel = {
      id: "r1",
      coin: "BTC",
      kind: "resistance",
      price: 100,
      note: "",
      createdAt: 0,
      sessionDate: "2026-09-04",
    };
    // NY session 2026-09-04 9:30 ET = 13:30 UTC
    const open = Date.UTC(2026, 8, 4, 13, 30, 0);
    const candles: Candle[] = [];
    const push = (offsetMin: number, o: number, h: number, l: number, c: number) => {
      const t = open + offsetMin * 60_000;
      candles.push({ t, T: t + 299_999, s: "BTC", i: "5m", o, h, l, c, v: 8, n: 3 });
    };
    push(0, 98.5, 99.2, 98.2, 99.0); // still below
    push(5, 99.0, 101.4, 98.9, 101.1); // close above 100 — break
    push(10, 101.0, 101.3, 99.85, 100.4); // pullback tags level, close holds
    push(15, 100.5, 100.6, 100.1, 100.2); // small bearish
    push(20, 100.15, 102.4, 100.05, 102.1); // bullish engulfing

    const now = open + 25 * 60_000;
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [level],
      config: DEFAULT_STRATEGY,
      now,
    });
    assert.equal(setups[0]?.phase, "filled");
    assert.equal(signal.action, "long");
    assert.ok(signal.stopPrice && signal.stopPrice < 100);
  });

  it("does not enter outside the New York session", () => {
    const level: ChartLevel = {
      id: "r1",
      coin: "BTC",
      kind: "resistance",
      price: 100,
      note: "",
      createdAt: 0,
      sessionDate: "2026-09-04",
    };
    const candles = [bar(1, 99, 101, 98, 101)];
    const { signal } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [level],
      config: DEFAULT_STRATEGY,
      now: Date.UTC(2026, 8, 4, 12, 0, 0),
    });
    assert.equal(signal.action, "hold");
    assert.match(signal.reason, /Premarket|session/i);
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
