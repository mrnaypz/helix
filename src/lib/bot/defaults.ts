import type { BotConfig, BotState, PaperAccount, StrategyConfig } from "./types";
import { zonedParts } from "../strategy/session";

export const DEFAULT_STRATEGY: StrategyConfig = {
  atrPeriod: 14,
  atrStopMultiplier: 1.5,
  atrTakeMultiplier: 2.5,
  riskPctPerTrade: 1,
  maxLeverage: 3,
  maxPositions: 2,
  dailyLossLimitPct: 3,
  cooldownMinutes: 30,
  allowShort: true,
  slippageBps: 4,
  takerFeeBps: 3.5,
  sessionTimeZone: "America/New_York",
  sessionStartMinutes: 9 * 60 + 30,
  sessionEndMinutes: 16 * 60,
  flattenAtSessionEnd: true,
  retestToleranceBps: 12,
  retestAtrFrac: 0.15,
  maxBarsAfterBreak: 18,
  rewardRisk: 2,
  stopBufferAtr: 0.1,
};

export const DEFAULT_CONFIG: BotConfig = {
  mode: "paper",
  network: "mainnet",
  coins: ["BTC", "ETH", "SOL"],
  interval: "5m",
  tickMs: 10_000,
  startingEquity: 10_000,
  strategy: DEFAULT_STRATEGY,
};

export function createPaperAccount(startingEquity: number, now = Date.now()): PaperAccount {
  const day = zonedParts(now, DEFAULT_STRATEGY.sessionTimeZone);
  return {
    cash: startingEquity,
    equity: startingEquity,
    startingEquity,
    realizedPnl: 0,
    unrealizedPnl: 0,
    dayStartEquity: startingEquity,
    dayStartTs: now,
    dayKey: day.dateKey,
    feesPaid: 0,
  };
}

export function utcDayStart(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function createInitialState(config: BotConfig = DEFAULT_CONFIG): BotState {
  return {
    status: "stopped",
    haltReason: null,
    config,
    paper: createPaperAccount(config.startingEquity),
    positions: [],
    fills: [],
    events: [],
    equityCurve: [{ ts: Date.now(), equity: config.startingEquity }],
    lastSignals: [],
    lastBarProcessed: {},
    cooldownUntil: {},
    levels: [],
    setups: [],
    lastSessionFlattenDate: null,
    lastTickAt: null,
    lastError: null,
    ticks: 0,
  };
}

export const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "8h": 28_800_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
};
