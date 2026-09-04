import type { BotConfig, BotState, PaperAccount, StrategyConfig } from "./types";

export const DEFAULT_STRATEGY: StrategyConfig = {
  fastEma: 9,
  slowEma: 21,
  atrPeriod: 14,
  atrStopMultiplier: 1.8,
  atrTakeMultiplier: 3.2,
  riskPctPerTrade: 1,
  maxLeverage: 3,
  maxPositions: 2,
  dailyLossLimitPct: 3,
  cooldownMinutes: 45,
  trendFilter: true,
  allowShort: true,
  slippageBps: 4,
  takerFeeBps: 3.5,
};

export const DEFAULT_CONFIG: BotConfig = {
  mode: "paper",
  network: "mainnet",
  coins: ["BTC", "ETH", "SOL"],
  interval: "15m",
  tickMs: 15_000,
  startingEquity: 10_000,
  strategy: DEFAULT_STRATEGY,
};

export function createPaperAccount(startingEquity: number, now = Date.now()): PaperAccount {
  return {
    cash: startingEquity,
    equity: startingEquity,
    startingEquity,
    realizedPnl: 0,
    unrealizedPnl: 0,
    dayStartEquity: startingEquity,
    dayStartTs: utcDayStart(now),
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
