import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInitialState, DEFAULT_CONFIG } from "./defaults";
import type { BotConfig, BotState } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "bot-state.json");

function mergeConfig(raw: Partial<BotConfig> | undefined): BotConfig {
  const base = DEFAULT_CONFIG;
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    coins: raw.coins?.length ? raw.coins : base.coins,
    strategy: { ...base.strategy, ...(raw.strategy ?? {}) },
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
