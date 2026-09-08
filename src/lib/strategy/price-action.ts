import type { Candle, ChartLevel, LevelSetup, SetupPhase, Signal, StrategyConfig } from "../bot/types";
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
  // Body still wraps the previous body, and the close must clear the previous wick — not only the body high.
  return bodyLow(curr) <= bodyLow(prev) && curr.c > prev.h;
}

export function bearishEngulfing(prev: Candle, curr: Candle): boolean {
  if (!isBearish(curr)) return false;
  if (isBearish(prev)) return false;
  return bodyHigh(curr) >= bodyHigh(prev) && curr.c < prev.l;
}

export function postBreakRange(
  candles: Candle[],
  breakIndex: number,
  endExclusive: number,
): { high: number; low: number } | null {
  if (breakIndex < 0 || endExclusive <= breakIndex) return null;
  let high = -Infinity;
  let low = Infinity;
  for (let j = breakIndex; j < endExclusive; j++) {
    high = Math.max(high, candles[j].h);
    low = Math.min(low, candles[j].l);
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return { high, low };
}

export function bullishRangeBreak(curr: Candle, rangeHigh: number): boolean {
  return isBullish(curr) && curr.c > rangeHigh;
}

export function bearishRangeBreak(curr: Candle, rangeLow: number): boolean {
  return isBearish(curr) && curr.c < rangeLow;
}

export function candleBody(c: Candle): number {
  return Math.abs(c.c - c.o);
}

export function candleRange(c: Candle): number {
  return Math.max(c.h - c.l, 0);
}

export function opposingWickFraction(c: Candle, side: "long" | "short"): number {
  const range = candleRange(c);
  if (range <= 0) return 1;
  if (side === "long") return (c.h - Math.max(c.o, c.c)) / range;
  return (Math.min(c.o, c.c) - c.l) / range;
}

export function atrPriorTo(history: Candle[], atrValues: number[], barTime: number): number {
  const idx = history.findIndex((c) => c.t === barTime);
  const end = idx === -1 ? history.length : idx;
  for (let j = end - 1; j >= 0; j--) {
    if (Number.isFinite(atrValues[j]) && atrValues[j]! > 0) return atrValues[j]!;
  }
  if (end <= 0) return 0;
  let sum = 0;
  for (let j = 0; j < end; j++) {
    const c = history[j];
    const tr =
      j === 0
        ? c.h - c.l
        : Math.max(c.h - c.l, Math.abs(c.h - history[j - 1].c), Math.abs(c.l - history[j - 1].c));
    sum += tr;
  }
  return sum / end;
}

export function engulfingMeetsQuality(args: {
  prev: Candle;
  curr: Candle;
  side: "long" | "short";
  atr: number;
  minBodyAtr: number;
  maxOpposingWickFrac: number;
}): boolean {
  const { prev, curr, side, atr, minBodyAtr, maxOpposingWickFrac } = args;
  if (atr <= 0) return false;
  const need = minBodyAtr * atr;
  if (candleBody(prev) + 1e-12 < need) return false;
  if (candleBody(curr) + 1e-12 < need) return false;
  return opposingWickFraction(curr, side) + 1e-12 < maxOpposingWickFrac;
}

function replayLevel(args: {
  level: ChartLevel;
  candles: Candle[];
  history: Candle[];
  atrValues: number[];
  atrValue: number;
  config: StrategyConfig;
}): { setup: LevelSetup; entry: Signal | null } {
  const { level, candles, history, atrValues, atrValue, config } = args;
  const minPause = Math.max(1, Math.round(config.minConsolidationBars ?? 3));
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
  let phase: SetupPhase = "watching";
  let pauseBars = 0;
  let swing: number | null = null;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const last = i === candles.length - 1;
    if (curr.t < (level.createdAt || 0)) continue;

    const barsSinceBreak = breakIndex >= 0 ? i - breakIndex : 0;

    if (phase === "watching") {
      const longBreak = level.kind === "resistance" && prev.c <= level.price && curr.c > level.price;
      const shortBreak = level.kind === "support" && prev.c >= level.price && curr.c < level.price;
      if (longBreak || shortBreak) {
        phase = "broken";
        breakIndex = i;
        pauseBars = 0;
        swing = level.kind === "resistance" ? curr.l : curr.h;
        setup.brokeAt = curr.t;
        setup.detail =
          level.kind === "resistance"
            ? `Broke above ${level.price} — waiting for ${minPause} bars of consolidation`
            : `Broke below ${level.price} — waiting for ${minPause} bars of consolidation`;
      }
      continue;
    }

    const failedLong = level.kind === "resistance" && curr.c < level.price;
    const failedShort = level.kind === "support" && curr.c > level.price;
    if (failedLong || failedShort) {
      phase = "failed";
      setup.detail =
        "Invalidated — 5m close back through the level. No trade. Chart a new level to re-arm this market.";
      break;
    }

    if (breakIndex >= 0 && barsSinceBreak > config.maxBarsAfterBreak) {
      phase = "failed";
      setup.detail = "Setup expired — no continuation in time";
      break;
    }

    if (level.kind === "resistance") {
      swing = Math.min(swing ?? curr.l, curr.l);
    } else {
      swing = Math.max(swing ?? curr.h, curr.h);
    }

    if (phase === "broken") {
      pauseBars += 1;
      setup.detail = `Consolidating ${pauseBars}/${minPause} after the break — does not have to tag ${level.price}`;
      if (pauseBars >= minPause) {
        phase = "consolidated";
        setup.detail = config.allowRangeBreakEntry
          ? `Consolidated — waiting for engulfing or a close beyond the post-break ${level.kind === "resistance" ? "high" : "low"}`
          : `Consolidated — waiting for a ${level.kind === "resistance" ? "bullish" : "bearish"} engulfing trigger`;
      }
      continue;
    }

    if (phase === "consolidated" || phase === "retested") {
      const range = postBreakRange(candles, breakIndex, i);
      const atr = atrPriorTo(history, atrValues, curr.t);
      const quality = {
        prev,
        curr,
        atr,
        minBodyAtr: config.minEngulfBodyAtr ?? 0.25,
        maxOpposingWickFrac: config.maxOpposingWickFrac ?? 0.3,
      };
      const longEngulf =
        level.kind === "resistance" &&
        bullishEngulfing(prev, curr) &&
        engulfingMeetsQuality({ ...quality, side: "long" });
      const shortEngulf =
        level.kind === "support" &&
        bearishEngulfing(prev, curr) &&
        engulfingMeetsQuality({ ...quality, side: "short" });
      if (
        ((level.kind === "resistance" && bullishEngulfing(prev, curr)) ||
          (level.kind === "support" && bearishEngulfing(prev, curr))) &&
        !longEngulf &&
        !shortEngulf
      ) {
        setup.detail = `Rejected engulfing — need ${quality.minBodyAtr}× ATR bodies and opposing wick under ${Math.round(quality.maxOpposingWickFrac * 100)}%`;
      }
      const longRange =
        Boolean(config.allowRangeBreakEntry) &&
        level.kind === "resistance" &&
        range != null &&
        bullishRangeBreak(curr, range.high);
      const shortRange =
        Boolean(config.allowRangeBreakEntry) &&
        level.kind === "support" &&
        range != null &&
        bearishRangeBreak(curr, range.low);
      const longEntry = longEngulf || longRange;
      const shortEntry = shortEngulf || shortRange;
      if (longEntry || shortEntry) {
        phase = "filled";
        setup.detail = longEngulf
          ? "Bullish engulfing after consolidation"
          : shortEngulf
            ? "Bearish engulfing after consolidation"
            : longRange
              ? "Range break of the post-break high"
              : "Range break of the post-break low";
        setup.phase = phase;
        setup.retestExtreme = swing;
        if (!last) {
          return { setup, entry: null };
        }

        const side = longEntry ? "long" : "short";
        return {
          setup,
          entry: {
            coin: level.coin,
            action: side,
            reason: `${setup.detail} at ${level.kind} ${level.price}`,
            atr: atrValue,
            close: curr.c,
            barTime: curr.t,
            levelPrice: level.price,
            phase,
            brokeAt: setup.brokeAt,
          },
        };
      }
    }
  }

  setup.phase = phase;
  setup.retestExtreme = swing;
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
      history: args.candles,
      atrValues,
      atrValue,
      config: args.config,
    });
    setups.push(result.setup);
    if (result.entry) entries.push(result.entry);
  }

  if (entries.length) {
    const signal = entries.sort((a, b) => (a.brokeAt ?? a.barTime) - (b.brokeAt ?? b.barTime))[0];
    return { setups, signal };
  }

  const live =
    setups.find((s) => s.phase === "consolidated" || s.phase === "retested") ??
    setups.find((s) => s.phase === "broken") ??
    setups.find((s) => s.phase === "watching") ??
    setups[0];
  return {
    setups,
    signal: {
      ...base,
      reason: live?.detail ?? "Watching charted levels",
      levelPrice: live?.price,
      phase: live?.phase,
      brokeAt: live?.brokeAt,
    },
  };
}
