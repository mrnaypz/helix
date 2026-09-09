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
export type LevelKind = "resistance" | "support";
export type SetupPhase = "watching" | "broken" | "consolidated" | "retested" | "filled" | "failed";

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
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTakeMultiplier: number;
  riskPctPerTrade: number;
  maxLeverage: number;
  maxPositions: number;
  dailyLossLimitPct: number;
  cooldownMinutes: number;
  allowShort: boolean;
  slippageBps: number;
  takerFeeBps: number;
  sessionTimeZone: string;
  sessionStartMinutes: number;
  sessionEndMinutes: number;
  flattenAtSessionEnd: boolean;
  retestToleranceBps: number;
  retestAtrFrac: number;
  maxBarsAfterBreak: number;
  minConsolidationBars: number;
  allowRangeBreakEntry: boolean;
  minPrevBodyAtr: number;
  minEngulfBodyAtr: number;
  maxOpposingWickFrac: number;
  flattenOnLevelFail: boolean;
  rewardRisk: number;
  stopBufferAtr: number;
  stopLossPricePct: number;
  takeProfitPricePct: number;
  oneToOneTarget: boolean;
  breakEvenPricePct: number;
  giveUpPricePct: number;
  giveUpBars: number;
  marginPct: number;
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

export type ChartLevel = {
  id: string;
  coin: string;
  kind: LevelKind;
  price: number;
  note: string;
  createdAt: number;
  sessionDate: string;
};

export type LevelSetup = {
  levelId: string;
  coin: string;
  kind: LevelKind;
  price: number;
  phase: SetupPhase;
  detail: string;
  brokeAt: number | null;
  retestExtreme: number | null;
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
  breakEvenStop: boolean;
  giveUpArmedBarTime: number | null;
  levelPrice: number | null;
  entryBarTime: number | null;
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

export type ClosedTrade = {
  id: string;
  openedAt: number;
  closedAt: number;
  coin: string;
  side: Side;
  size: number;
  entryPrice: number;
  exitPrice: number;
  notional: number;
  margin: number;
  realizedPnl: number;
  priceMovePct: number;
  roePct: number;
  stopPrice: number | null;
  takePrice: number | null;
  stopPct: number | null;
  takePct: number | null;
  levelPrice: number | null;
  leverage: number;
  fee: number;
  reason: string;
  breakEvenStop: boolean;
  mode: ExecutionMode;
  complete: boolean;
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
  atr: number;
  close: number;
  barTime: number;
  stopPrice?: number;
  takePrice?: number;
  levelPrice?: number;
  phase?: SetupPhase;
  brokeAt?: number | null;
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
  dayKey: string;
  feesPaid: number;
};

export type LiveReadiness = {
  hasAccount: boolean;
  hasAgentKey: boolean;
  liveConfirm: boolean;
  network: Network;
  accountAddress: string | null;
};

export type SessionSnapshot = {
  inSession: boolean;
  weekend: boolean;
  dateKey: string;
  clock: string;
  label: string;
  startLabel: string;
  endLabel: string;
};

export type BotState = {
  status: BotStatus;
  haltReason: string | null;
  config: BotConfig;
  paper: PaperAccount;
  positions: Position[];
  fills: Fill[];
  closedTrades: ClosedTrade[];
  events: BotEvent[];
  equityCurve: EquityPoint[];
  lastSignals: Signal[];
  lastBarProcessed: Record<string, number>;
  cooldownUntil: Record<string, number>;
  levels: ChartLevel[];
  setups: LevelSetup[];
  lastSessionFlattenDate: string | null;
  lastTickAt: number | null;
  lastError: string | null;
  ticks: number;
};

export type PublicBotSnapshot = {
  state: BotState;
  markets: MarketSnapshot[];
  live: LiveReadiness;
  session: SessionSnapshot;
  nextTickInMs: number | null;
};
