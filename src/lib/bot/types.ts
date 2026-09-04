export type Interval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d";

export type Network = "mainnet" | "testnet";
export type ExecutionMode = "paper" | "live";
export type Side = "long" | "short";
export type BotStatus = "stopped" | "running" | "paused" | "halted";

export type Candle = {
  t: number;
  T: number;
  s: string;
  i: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
};

export type StrategyConfig = {
  fastEma: number;
  slowEma: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTakeMultiplier: number;
  riskPctPerTrade: number;
  maxLeverage: number;
  maxPositions: number;
  dailyLossLimitPct: number;
  cooldownMinutes: number;
  trendFilter: boolean;
  allowShort: boolean;
  slippageBps: number;
  takerFeeBps: number;
};

export type BotConfig = {
  mode: ExecutionMode;
  network: Network;
  coins: string[];
  interval: Interval;
  tickMs: number;
  startingEquity: number;
  strategy: StrategyConfig;
};

export type Position = {
  coin: string;
  side: Side;
  size: number;
  entryPrice: number;
  markPrice: number;
  stopPrice: number;
  takePrice: number;
  leverage: number;
  notional: number;
  unrealizedPnl: number;
  openedAt: number;
  atrAtEntry: number;
};

export type Fill = {
  id: string;
  ts: number;
  coin: string;
  side: Side;
  action: "open" | "close";
  reason: string;
  size: number;
  price: number;
  fee: number;
  pnl: number;
  mode: ExecutionMode;
};

export type BotEvent = {
  id: string;
  ts: number;
  level: "info" | "trade" | "warn" | "error";
  message: string;
  coin?: string;
};

export type Signal = {
  coin: string;
  action: "long" | "short" | "flat" | "hold";
  reason: string;
  fastEma: number;
  slowEma: number;
  atr: number;
  close: number;
  barTime: number;
};

export type MarketSnapshot = {
  coin: string;
  markPx: number;
  midPx: number;
  funding: number;
  prevDayPx: number;
  dayNtlVlm: number;
  openInterest: number;
  szDecimals: number;
  maxLeverage: number;
  assetIndex: number;
  changePct: number;
};

export type EquityPoint = {
  ts: number;
  equity: number;
};

export type PaperAccount = {
  cash: number;
  equity: number;
  startingEquity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dayStartEquity: number;
  dayStartTs: number;
  feesPaid: number;
};

export type LiveReadiness = {
  hasAccount: boolean;
  hasAgentKey: boolean;
  liveConfirm: boolean;
  network: Network;
  accountAddress: string | null;
};

export type BotState = {
  status: BotStatus;
  haltReason: string | null;
  config: BotConfig;
  paper: PaperAccount;
  positions: Position[];
  fills: Fill[];
  events: BotEvent[];
  equityCurve: EquityPoint[];
  lastSignals: Signal[];
  lastBarProcessed: Record<string, number>;
  cooldownUntil: Record<string, number>;
  lastTickAt: number | null;
  lastError: string | null;
  ticks: number;
};

export type PublicBotSnapshot = {
  state: BotState;
  markets: MarketSnapshot[];
  live: LiveReadiness;
  nextTickInMs: number | null;
};
