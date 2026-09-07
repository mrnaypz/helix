import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInitialState, CORE_COINS, DEFAULT_CONFIG, DEFAULT_STRATEGY, TRADE_LEVERAGE } from "./defaults";
import { ensureClosedTrades } from "./trades";
import type { BotConfig, BotState, StrategyConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "bot-state.json");

export function migrateCoins(raw?: string[] | null): string[] {
  const extra = (raw ?? [])
    .map((coin) => coin.trim().toUpperCase())
    .filter((coin) => coin && !(CORE_COINS as readonly string[]).includes(coin));
  return [...CORE_COINS, ...extra];
}

type LegacyStrategy = Partial<StrategyConfig> & {
  stopLossRoePct?: number;
  takeProfitRoePct?: number;
  breakEvenRoePct?: number;
  giveUpRoePct?: number;
};

function priceFromLegacyRoe(price: number | undefined, roe: number | undefined, fallback: number): number {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof roe === "number" && Number.isFinite(roe)) return roe / TRADE_LEVERAGE;
  return fallback;
}

function migrateStrategy(raw: Partial<StrategyConfig> | undefined): StrategyConfig {
  const incoming = (raw ?? {}) as LegacyStrategy;
  const fromEma = !("sessionStartMinutes" in incoming);
  return {
    ...DEFAULT_STRATEGY,
    ...incoming,
    maxPositions: 1,
    maxLeverage: TRADE_LEVERAGE,
    minConsolidationBars: incoming.minConsolidationBars ?? DEFAULT_STRATEGY.minConsolidationBars,
    allowRangeBreakEntry: incoming.allowRangeBreakEntry ?? DEFAULT_STRATEGY.allowRangeBreakEntry,
    maxBreakThroughAtr: incoming.maxBreakThroughAtr ?? DEFAULT_STRATEGY.maxBreakThroughAtr,
    minEngulfBodyAtr: incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minEngulfBodyAtr,
    maxOpposingWickFrac: incoming.maxOpposingWickFrac ?? DEFAULT_STRATEGY.maxOpposingWickFrac,
    flattenOnLevelFail: incoming.flattenOnLevelFail ?? DEFAULT_STRATEGY.flattenOnLevelFail,
    oneToOneTarget: incoming.oneToOneTarget ?? DEFAULT_STRATEGY.oneToOneTarget,
    stopLossPricePct: priceFromLegacyRoe(incoming.stopLossPricePct, incoming.stopLossRoePct, DEFAULT_STRATEGY.stopLossPricePct),
    takeProfitPricePct: priceFromLegacyRoe(incoming.takeProfitPricePct, incoming.takeProfitRoePct, DEFAULT_STRATEGY.takeProfitPricePct),
    breakEvenPricePct: priceFromLegacyRoe(incoming.breakEvenPricePct, incoming.breakEvenRoePct, DEFAULT_STRATEGY.breakEvenPricePct),
    giveUpPricePct: priceFromLegacyRoe(incoming.giveUpPricePct, incoming.giveUpRoePct, DEFAULT_STRATEGY.giveUpPricePct),
    giveUpBars: incoming.giveUpBars ?? DEFAULT_STRATEGY.giveUpBars,
    marginPct: incoming.marginPct ?? DEFAULT_STRATEGY.marginPct,
    ...(fromEma
      ? {
          sessionStartMinutes: DEFAULT_STRATEGY.sessionStartMinutes,
          sessionEndMinutes: DEFAULT_STRATEGY.sessionEndMinutes,
        }
      : {}),
  };
}

function mergeConfig(raw: Partial<BotConfig> | undefined): BotConfig {
  const base = DEFAULT_CONFIG;
  if (!raw) return base;
  const fromEma = !raw.strategy || !("sessionStartMinutes" in raw.strategy);
  return {
    ...base,
    ...raw,
    interval: fromEma ? "5m" : (raw.interval ?? base.interval),
    tickMs: fromEma ? 10_000 : (raw.tickMs ?? base.tickMs),
    coins: migrateCoins(raw.coins),
    strategy: migrateStrategy(raw.strategy),
  };
}

export async function loadState(): Promise<BotState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as BotState;
    parsed.config = mergeConfig(parsed.config);
    parsed.events = parsed.events ?? [];
    parsed.fills = parsed.fills ?? [];
    parsed.closedTrades = parsed.closedTrades ?? [];
    ensureClosedTrades(parsed);
    parsed.positions = (parsed.positions ?? []).map((p) => ({
      ...p,
      breakEvenStop: p.breakEvenStop ?? false,
      giveUpArmedBarTime: p.giveUpArmedBarTime ?? null,
      levelPrice: p.levelPrice ?? null,
      entryBarTime: p.entryBarTime ?? null,
    }));
    parsed.equityCurve = parsed.equityCurve ?? [];
    parsed.lastSignals = parsed.lastSignals ?? [];
    parsed.lastBarProcessed = parsed.lastBarProcessed ?? {};
    parsed.cooldownUntil = parsed.cooldownUntil ?? {};
    parsed.levels = parsed.levels ?? [];
    parsed.setups = parsed.setups ?? [];
    parsed.lastSessionFlattenDate = parsed.lastSessionFlattenDate ?? null;
    parsed.paper.dayKey = parsed.paper.dayKey ?? "";
    return parsed;
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: BotState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const slim: BotState = {
    ...state,
    events: state.events.slice(0, 250),
    fills: state.fills.slice(0, 250),
    closedTrades: (state.closedTrades ?? []).slice(0, 100),
    equityCurve: state.equityCurve.slice(-500),
  };
  await writeFile(STATE_PATH, JSON.stringify(slim, null, 2));
}
