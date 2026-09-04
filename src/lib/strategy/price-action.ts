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

function replayLevel(args: {
  level: ChartLevel;
  candles: Candle[];
  atrValue: number;
  config: StrategyConfig;
}): { setup: LevelSetup; entry: Signal | null } {
  const { level, candles, atrValue, config } = args;
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
        setup.detail = `Consolidated — waiting for a ${level.kind === "resistance" ? "bullish" : "bearish"} engulfing trigger`;
      }
      continue;
    }

    if (phase === "consolidated" || phase === "retested") {
      const longEntry = level.kind === "resistance" && bullishEngulfing(prev, curr);
      const shortEntry = level.kind === "support" && bearishEngulfing(prev, curr);
      if (longEntry || shortEntry) {
        phase = "filled";
        setup.detail = longEntry
          ? "Bullish engulfing after consolidation"
          : "Bearish engulfing after consolidation";
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
