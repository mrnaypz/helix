import type { Candle, ChartLevel, LevelSetup, Signal, StrategyConfig } from "../bot/types";
import { atr as atrSeries, lastFinite } from "./indicators";
import { isSessionBar, sessionStatus } from "./session";

function bodyLow(c: Candle): number {
  return Math.min(c.o, c.c);
}

function bodyHigh(c: Candle): number {
  return Math.max(c.o, c.c);
}

export function isBullish(c: Candle): boolean {
  return c.c > c.o;
}

export function isBearish(c: Candle): boolean {
  return c.c < c.o;
}

export function bullishEngulfing(prev: Candle, curr: Candle): boolean {
  if (!isBullish(curr)) return false;
  if (!isBearish(prev) && prev.c === prev.o) return false;
  if (isBullish(prev)) return false;
  return bodyLow(curr) <= bodyLow(prev) && bodyHigh(curr) >= bodyHigh(prev);
}

export function bearishEngulfing(prev: Candle, curr: Candle): boolean {
  if (!isBearish(curr)) return false;
  if (isBearish(prev)) return false;
  return bodyLow(curr) <= bodyLow(prev) && bodyHigh(curr) >= bodyHigh(prev);
}

function retestZone(price: number, atrValue: number, config: StrategyConfig): number {
  return Math.max(price * (config.retestToleranceBps / 10_000), atrValue * config.retestAtrFrac);
}

function nextTarget(levels: ChartLevel[], coin: string, side: "long" | "short", entry: number): number | null {
  const same = levels.filter((l) => l.coin === coin);
  if (side === "long") {
    const above = same
      .filter((l) => l.kind === "resistance" && l.price > entry)
      .map((l) => l.price)
      .sort((a, b) => a - b);
    return above[0] ?? null;
  }
  const below = same
    .filter((l) => l.kind === "support" && l.price < entry)
    .map((l) => l.price)
    .sort((a, b) => b - a);
  return below[0] ?? null;
}

function replayLevel(args: {
  level: ChartLevel;
  candles: Candle[];
  atrValue: number;
  config: StrategyConfig;
}): { setup: LevelSetup; entry: Signal | null } {
  const { level, candles, atrValue, config } = args;
  const zone = retestZone(level.price, atrValue, config);
  const setup: LevelSetup = {
    levelId: level.id,
    coin: level.coin,
    kind: level.kind,
    price: level.price,
    phase: "watching",
    detail: `Watching ${level.kind} ${level.price}`,
    brokeAt: null,
    retestExtreme: null,
  };

  let breakIndex = -1;
  let phase: LevelSetup["phase"] = "watching";
  let retestExtreme: number | null = null;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const last = i === candles.length - 1;
    const barsSinceBreak = breakIndex >= 0 ? i - breakIndex : 0;

    if (phase === "filled" || phase === "failed") break;

    if (phase === "watching") {
      const longBreak = level.kind === "resistance" && prev.c <= level.price && curr.c > level.price;
      const shortBreak = level.kind === "support" && prev.c >= level.price && curr.c < level.price;
      if (longBreak || shortBreak) {
        phase = "broken";
        breakIndex = i;
        setup.brokeAt = curr.t;
        setup.detail =
          level.kind === "resistance"
            ? `Broke above ${level.price} — waiting for a pullback`
            : `Broke below ${level.price} — waiting for a pullback`;
      }
      continue;
    }

    if (breakIndex >= 0 && barsSinceBreak > config.maxBarsAfterBreak) {
      phase = "failed";
      setup.detail = "Setup expired — no continuation in time";
      break;
    }

    if (phase === "broken" || phase === "retested") {
      const failedLong = level.kind === "resistance" && curr.c < level.price;
      const failedShort = level.kind === "support" && curr.c > level.price;
      if (failedLong || failedShort) {
        phase = "watching";
        breakIndex = -1;
        retestExtreme = null;
        setup.brokeAt = null;
        setup.detail = "Failed break — back to watching";
        continue;
      }
    }

    if (phase === "broken") {
      const longRetest = level.kind === "resistance" && curr.l <= level.price + zone && curr.c >= level.price;
      const shortRetest = level.kind === "support" && curr.h >= level.price - zone && curr.c <= level.price;
      if (longRetest || shortRetest) {
        phase = "retested";
        retestExtreme = level.kind === "resistance" ? curr.l : curr.h;
        setup.detail =
          level.kind === "resistance"
            ? `Retested ${level.price} — waiting for a bullish engulfing candle`
            : `Retested ${level.price} — waiting for a bearish engulfing candle`;
      }
      continue;
    }

    if (phase === "retested") {
      if (level.kind === "resistance") {
        retestExtreme = Math.min(retestExtreme ?? curr.l, curr.l);
      } else {
        retestExtreme = Math.max(retestExtreme ?? curr.h, curr.h);
      }

      const longEntry = level.kind === "resistance" && bullishEngulfing(prev, curr);
      const shortEntry = level.kind === "support" && bearishEngulfing(prev, curr);
      if (longEntry || shortEntry) {
        phase = "filled";
        setup.detail = longEntry ? "Bullish engulfing after retest" : "Bearish engulfing after retest";
        setup.phase = phase;
        setup.retestExtreme = retestExtreme;
        if (!last) {
          return { setup, entry: null };
        }

        const side = longEntry ? "long" : "short";
        const close = curr.c;
        const buffer = Math.max(atrValue * config.stopBufferAtr, close * 0.0002);
        const swing = retestExtreme ?? (side === "long" ? curr.l : curr.h);
        const stopPrice = side === "long" ? Math.min(swing, level.price) - buffer : Math.max(swing, level.price) + buffer;
        const stopDist = Math.abs(close - stopPrice);
        const rTarget = side === "long" ? close + stopDist * config.rewardRisk : close - stopDist * config.rewardRisk;
        return {
          setup,
          entry: {
            coin: level.coin,
            action: side,
            reason: setup.detail + ` at ${level.kind} ${level.price}`,
            atr: atrValue,
            close,
            barTime: curr.t,
            stopPrice,
            takePrice: rTarget,
            levelPrice: level.price,
            phase,
          },
        };
      }
    }
  }

  setup.phase = phase;
  setup.retestExtreme = retestExtreme;
  if (phase === "watching" && setup.detail.startsWith("Watching")) {
    setup.detail = `Watching ${level.kind} ${level.price}`;
  }
  return { setup, entry: null };
}

export function evaluatePriceAction(args: {
  coin: string;
  candles: Candle[];
  levels: ChartLevel[];
  config: StrategyConfig;
  now?: number;
}): { setups: LevelSetup[]; signal: Signal } {
  const now = args.now ?? Date.now();
  const session = sessionStatus(now, args.config);
  const atrValues = atrSeries(args.candles, args.config.atrPeriod);
  const last = args.candles.at(-1);
  const atrValue = lastFinite(atrValues) ?? Math.max((last?.h ?? 0) - (last?.l ?? 0), (last?.c ?? 0) * 0.002);
  const base: Signal = {
    coin: args.coin,
    action: "hold",
    reason: "Waiting",
    atr: atrValue,
    close: last?.c ?? 0,
    barTime: last?.t ?? 0,
  };

  if (!session.inSession) {
    return { setups: [], signal: { ...base, reason: session.label } };
  }

  const coinLevels = args.levels.filter((l) => l.coin === args.coin);
  if (coinLevels.length === 0) {
    return {
      setups: [],
      signal: { ...base, reason: "No levels charted for this market today" },
    };
  }

  if (!last || atrValue <= 0) {
    return { setups: [], signal: { ...base, reason: "Waiting on 5m candle history" } };
  }

  const sessionBars = args.candles.filter((c) => isSessionBar(c.T, args.config, session.dateKey));
  if (sessionBars.length < 3) {
    return {
      setups: coinLevels.map((level) => ({
        levelId: level.id,
        coin: level.coin,
        kind: level.kind,
        price: level.price,
        phase: "watching" as const,
        detail: "Waiting for New York 5m bars",
        brokeAt: null,
        retestExtreme: null,
      })),
      signal: { ...base, reason: "Waiting for New York 5m bars" },
    };
  }

  const setups: LevelSetup[] = [];
  const entries: Signal[] = [];
  for (const level of coinLevels) {
    const result = replayLevel({
      level,
      candles: sessionBars,
      atrValue,
      config: args.config,
    });
    setups.push(result.setup);
    if (result.entry) entries.push(result.entry);
  }

  if (entries.length) {
    const signal = entries.sort((a, b) => Math.abs((a.levelPrice ?? 0) - a.close) - Math.abs((b.levelPrice ?? 0) - b.close))[0];
    const target = nextTarget(coinLevels, args.coin, signal.action === "short" ? "short" : "long", signal.close);
    if (target && signal.takePrice) {
      if (signal.action === "long") signal.takePrice = Math.min(signal.takePrice, target);
      if (signal.action === "short") signal.takePrice = Math.max(signal.takePrice, target);
    }
    return { setups, signal };
  }

  const live = setups.find((s) => s.phase === "retested") ?? setups.find((s) => s.phase === "broken") ?? setups[0];
  return {
    setups,
    signal: {
      ...base,
      reason: live?.detail ?? "Watching charted levels",
      levelPrice: live?.price,
      phase: live?.phase,
    },
  };
}
