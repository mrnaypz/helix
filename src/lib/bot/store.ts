import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInitialState, DEFAULT_CONFIG, DEFAULT_STRATEGY } from "./defaults";
import type { BotConfig, BotState, StrategyConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "bot-state.json");

function migrateStrategy(raw: Partial<StrategyConfig> | undefined): StrategyConfig {
  const incoming = raw ?? {};
  const fromEma = !("sessionStartMinutes" in incoming);
  return {
    ...DEFAULT_STRATEGY,
    ...incoming,
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
    coins:
      raw.coins?.length && raw.coins.join(",") !== "BTC,ETH,SOL"
        ? raw.coins
        : base.coins,
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
    parsed.positions = parsed.positions ?? [];
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
    equityCurve: state.equityCurve.slice(-500),
  };
  await writeFile(STATE_PATH, JSON.stringify(slim, null, 2));
}
