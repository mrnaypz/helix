import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, DEFAULT_STRATEGY, createPaperAccount } from "../bot/defaults";
import type { Candle, ChartLevel, Position } from "../bot/types";
import { paperFill, markToMarket } from "../bot/paper";
import { priceMovePctFromRoe, roeFromPriceMove, sizeFromMargin, sizeFromRisk, stopTakeFromPrice, stopTakeFromRoe, favorablePriceMovePct, shouldArmGiveUp, shouldGiveUp, shouldMoveStopToBreakEven, moveStopToBreakEven, closedBackThroughLevel } from "./risk";
import { formatClock, parseClock, sessionStatus } from "./session";
import {
  bearishEngulfing,
  bullishEngulfing,
  engulfingMeetsQuality,
  evaluatePriceAction,
  opposingWickFraction,
} from "./price-action";

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

function support(overrides: Partial<ChartLevel> = {}): ChartLevel {
  return {
    id: "s1",
    coin: "HYPE",
    kind: "support",
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
  it("detects a bullish engulfing that closes above the previous wick", () => {
    const prev = bar(0, 101, 101.2, 99.8, 100);
    const curr = bar(1, 99.9, 102.2, 99.7, 102);
    assert.equal(bullishEngulfing(prev, curr), true);
    assert.equal(bearishEngulfing(prev, curr), false);
  });

  it("rejects a body engulfing that does not close beyond the previous wick", () => {
    const prev = bar(0, 101, 103.4, 99.8, 100);
    const curr = bar(1, 99.9, 102.8, 99.7, 102.5);
    assert.equal(bullishEngulfing(prev, curr), false);
  });

  it("detects a bearish engulfing that closes below the previous wick", () => {
    const prev = bar(0, 100, 101.2, 99.8, 101);
    const curr = bar(1, 101.1, 101.2, 98.5, 98.7);
    assert.equal(bearishEngulfing(prev, curr), true);
    assert.equal(bullishEngulfing(prev, curr), false);
  });

  it("measures the opposing wick as a share of the bar", () => {
    const shortTail = bar(1, 100.0, 100.1, 98.4, 99.7);
    assert.ok(opposingWickFraction(shortTail, "short") > 0.5);
    assert.ok(opposingWickFraction(shortTail, "long") < 0.2);
  });

  it("refuses an engulfing unless both bodies clear 0.25× ATR and the opposing wick is under 30%", () => {
    const prev = bar(0, 100.4, 100.5, 100.35, 100.42);
    const skinny = bar(1, 100.45, 100.48, 99.2, 99.85);
    assert.equal(bearishEngulfing(prev, skinny), true);
    assert.equal(
      engulfingMeetsQuality({
        prev,
        curr: skinny,
        side: "short",
        atr: 0.8,
        minBodyAtr: 0.25,
        maxOpposingWickFrac: 0.3,
      }),
      false,
    );

    const solidPrev = bar(0, 100.25, 100.7, 100.2, 100.6);
    const solid = bar(1, 100.65, 100.7, 99.2, 99.3);
    assert.equal(bearishEngulfing(solidPrev, solid), true);
    assert.equal(
      engulfingMeetsQuality({
        prev: solidPrev,
        curr: solid,
        side: "short",
        atr: 0.8,
        minBodyAtr: 0.25,
        maxOpposingWickFrac: 0.3,
      }),
      true,
    );
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

  it("goes long on a range break that does not engulf the previous candle", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1), // break, high 101.4
      sessionBar(10, 101.0, 101.6, 100.6, 101.2), // pause 1, high 101.6
      sessionBar(15, 101.1, 101.4, 100.7, 100.9),
      sessionBar(20, 101.2, 101.5, 101.0, 101.4), // pause 3, bullish — next cannot engulf it
      sessionBar(25, 101.3, 102.8, 101.2, 102.5), // close above 101.6, does not engulf
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now: OPEN + 30 * 60_000,
    });
    assert.equal(setups[0]?.phase, "filled");
    assert.equal(signal.action, "long");
    assert.match(signal.reason, /Range break/);
  });

  it("does not treat a range break as an entry when the rule is off", () => {
    const candles: Candle[] = [
      sessionBar(0, 98.5, 99.2, 98.2, 99.0),
      sessionBar(5, 99.0, 101.4, 98.9, 101.1),
      sessionBar(10, 101.0, 101.6, 100.6, 101.2),
      sessionBar(15, 101.1, 101.4, 100.7, 100.9),
      sessionBar(20, 101.2, 101.5, 101.0, 101.4),
      sessionBar(25, 101.3, 102.8, 101.2, 102.5),
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: { ...DEFAULT_STRATEGY, allowRangeBreakEntry: false },
      now: OPEN + 30 * 60_000,
    });
    assert.notEqual(signal.action, "long");
    assert.equal(setups[0]?.phase, "consolidated");
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

  it("still treats a large ATR close through the level as a valid break", () => {
    const candles: Candle[] = [
      sessionBar(0, 99.65, 99.8, 99.55, 99.7),
      sessionBar(5, 99.7, 102.9, 99.6, 102.5),
      sessionBar(10, 102.4, 102.6, 102.1, 102.3),
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "BTC",
      candles,
      levels: [resistance()],
      config: DEFAULT_STRATEGY,
      now: OPEN + 15 * 60_000,
    });
    assert.equal(setups[0]?.phase, "broken");
    assert.equal(signal.action, "hold");
    assert.match(setups[0]?.detail ?? "", /Consolidating/);
  });

  it("rejects a short engulfing of a doji with a long opposing wick", () => {
    const candles: Candle[] = [
      sessionBar(0, 100.6, 100.8, 100.4, 100.5, "HYPE"),
      sessionBar(5, 100.5, 100.55, 99.55, 99.65, "HYPE"),
      sessionBar(10, 99.65, 99.85, 99.5, 99.7, "HYPE"),
      sessionBar(15, 99.7, 99.9, 99.55, 99.6, "HYPE"),
      sessionBar(20, 99.62, 99.7, 99.58, 99.64, "HYPE"),
      sessionBar(25, 99.66, 99.72, 98.85, 99.5, "HYPE"),
    ];
    const { signal, setups } = evaluatePriceAction({
      coin: "HYPE",
      candles,
      levels: [support()],
      config: { ...DEFAULT_STRATEGY, allowRangeBreakEntry: false },
      now: OPEN + 30 * 60_000,
    });
    assert.notEqual(signal.action, "short");
    assert.equal(setups[0]?.phase, "consolidated");
    assert.match(setups[0]?.detail ?? "", /Rejected engulfing/);
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

  it("places a 0.5% price stop and 1% target regardless of leverage", () => {
    assert.equal(priceMovePctFromRoe(5, 10), 0.5);
    assert.equal(roeFromPriceMove(0.5, 10), 5);
    assert.equal(roeFromPriceMove(0.5, 5), 2.5);
    assert.equal(roeFromPriceMove(1, 5), 5);
    const atTen = stopTakeFromPrice("long", 100, DEFAULT_STRATEGY);
    const atFive = stopTakeFromRoe("long", 100, 5, DEFAULT_STRATEGY);
    assert.equal(atTen.stopPrice, 99.5);
    assert.equal(atTen.takePrice, 101);
    assert.equal(atFive.stopPrice, 99.5);
    assert.equal(atFive.takePrice, 101);
  });

  it("slow-day 1:1 toggle sets take profit to 0.5% and ignores the 1% field", () => {
    const tight = stopTakeFromPrice("long", 100, { ...DEFAULT_STRATEGY, oneToOneTarget: true, takeProfitPricePct: 1 });
    assert.equal(tight.stopPrice, 99.5);
    assert.ok(Math.abs(tight.takePrice - 100.5) < 1e-9);
    const short = stopTakeFromPrice("short", 100, { ...DEFAULT_STRATEGY, oneToOneTarget: true });
    assert.ok(Math.abs(short.takePrice - 99.5) < 1e-9);
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

describe("trade management", () => {
  function longAt(entry: number, mark: number, extra: Partial<Position> = {}): Position {
    return {
      coin: "BTC",
      side: "long",
      size: 1,
      entryPrice: entry,
      markPrice: mark,
      stopPrice: entry * 0.995,
      takePrice: entry * 1.01,
      leverage: 10,
      notional: mark,
      unrealizedPnl: 0,
      openedAt: 1,
      atrAtEntry: 1,
      breakEvenStop: false,
      giveUpArmedBarTime: null,
      levelPrice: 100,
      entryBarTime: 1_000,
      ...extra,
    };
  }

  it("moves the stop to break-even after 0.55% even if leverage is 5x", () => {
    const before = longAt(100, 100.54, { leverage: 5 });
    assert.equal(shouldMoveStopToBreakEven(before, 100.54, DEFAULT_STRATEGY), false);
    const at = longAt(100, 100.55, { leverage: 5 });
    assert.ok(Math.abs(favorablePriceMovePct(at, 100.55) - 0.55) < 1e-9);
    assert.equal(shouldMoveStopToBreakEven(at, 100.55, DEFAULT_STRATEGY), true);
    moveStopToBreakEven(at);
    assert.equal(at.stopPrice, 100);
    assert.equal(at.breakEvenStop, true);
    assert.equal(shouldMoveStopToBreakEven(at, 100.8, DEFAULT_STRATEGY), false);
  });

  it("arms a 5-bar give-up after 0.8% and flattens once five later bars close", () => {
    const pos = longAt(100, 100.8);
    assert.equal(shouldArmGiveUp(pos, 100.79, DEFAULT_STRATEGY), false);
    assert.equal(shouldArmGiveUp(pos, 100.8, DEFAULT_STRATEGY), true);
    pos.giveUpArmedBarTime = 1_000;
    const four = [1000, 1300, 1600, 1900, 2200];
    assert.equal(shouldGiveUp(pos, four, DEFAULT_STRATEGY), false);
    const five = [...four, 2500];
    assert.equal(shouldGiveUp(pos, five, DEFAULT_STRATEGY), true);
  });

  it("flattens a long after a later 5m close back below the charted level", () => {
    const pos = longAt(100.4, 100.3, { levelPrice: 100, entryBarTime: 1_000 });
    const entryBar = { t: 1_000, c: 100.6 };
    const fail = { t: 1_300, c: 99.8 };
    assert.equal(closedBackThroughLevel(pos, [entryBar], DEFAULT_STRATEGY), false);
    assert.equal(closedBackThroughLevel(pos, [entryBar, fail], DEFAULT_STRATEGY), true);
    assert.equal(
      closedBackThroughLevel(pos, [entryBar, fail], { ...DEFAULT_STRATEGY, flattenOnLevelFail: false }),
      false,
    );
  });

  it("flattens a short after a later 5m close back above the charted level", () => {
    const pos = longAt(99.6, 99.7, { side: "short", levelPrice: 100, entryBarTime: 1_000, stopPrice: 100.5 });
    assert.equal(closedBackThroughLevel(pos, [{ t: 1_300, c: 100.2 }], DEFAULT_STRATEGY), true);
    assert.equal(closedBackThroughLevel(pos, [{ t: 1_300, c: 99.4 }], DEFAULT_STRATEGY), false);
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
