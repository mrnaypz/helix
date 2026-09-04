import { createInitialState, createPaperAccount, DEFAULT_CONFIG, utcDayStart } from "./defaults";
import { markToMarket, paperFill } from "./paper";
import { loadState, saveState } from "./store";
import { evaluateEmaCrossover } from "../strategy/ema-crossover";
import { hitStop, hitTake, sizeFromRisk, stopTakePrices } from "../strategy/risk";
import { canTradeLive, liveReadiness, placeMarketLike, setLeverage } from "../hyperliquid/exchange";
import { fetchCandles, fetchMarkets } from "../hyperliquid/info";
import type {
  BotConfig,
  BotEvent,
  BotState,
  Fill,
  MarketSnapshot,
  Signal,
} from "./types";

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function pushEvent(state: BotState, event: Omit<BotEvent, "id" | "ts">) {
  state.events.unshift({ id: eid("evt"), ts: Date.now(), ...event });
  state.events = state.events.slice(0, 250);
}

export class BotEngine {
  state: BotState;
  markets: MarketSnapshot[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(state?: BotState) {
    this.state = state ?? createInitialState();
  }

  static async create(): Promise<BotEngine> {
    const state = await loadState();
    const engine = new BotEngine(state);
    if (state.status === "running") {
      engine.startLoop();
    }
    return engine;
  }

  snapshot() {
    return {
      state: this.state,
      markets: this.markets,
      live: liveReadiness(),
      nextTickInMs: this.state.status === "running" ? this.state.config.tickMs : null,
    };
  }

  async persist() {
    this.persistQueue = this.persistQueue.then(() => saveState(this.state)).catch(() => undefined);
    await this.persistQueue;
  }

  async applyConfig(patch: Partial<BotConfig>) {
    const next: BotConfig = {
      ...this.state.config,
      ...patch,
      coins: patch.coins?.length ? patch.coins : this.state.config.coins,
      strategy: { ...this.state.config.strategy, ...(patch.strategy ?? {}) },
    };
    if (next.mode === "live" && !canTradeLive()) {
      throw new Error(
        "Live mode is locked until HL_ACCOUNT_ADDRESS, HL_AGENT_PRIVATE_KEY, and HL_LIVE_CONFIRM=I_UNDERSTAND are set.",
      );
    }
    if (next.startingEquity !== this.state.config.startingEquity && this.state.positions.length === 0) {
      this.state.paper = createPaperAccount(next.startingEquity);
      this.state.equityCurve = [{ ts: Date.now(), equity: next.startingEquity }];
    }
    this.state.config = next;
    await this.persist();
    pushEvent(this.state, { level: "info", message: "Strategy config updated" });
    return this.snapshot();
  }

  async start() {
    if (this.state.config.mode === "live" && !canTradeLive()) {
      throw new Error("Cannot start live trading: missing agent wallet, account address, or live confirmation.");
    }
    this.state.status = "running";
    this.state.haltReason = null;
    this.state.lastError = null;
    pushEvent(this.state, {
      level: "info",
      message:
        this.state.config.mode === "paper"
          ? "Paper engine started — using live Hyperliquid prices, no orders sent."
          : `Live engine started on ${liveReadiness().network}.`,
    });
    this.startLoop();
    await this.tick();
    await this.persist();
    return this.snapshot();
  }

  async pause() {
    this.state.status = "paused";
    this.stopLoop();
    pushEvent(this.state, { level: "warn", message: "Engine paused. Open positions are still marked to market when you resume." });
    await this.persist();
    return this.snapshot();
  }

  async stop() {
    this.state.status = "stopped";
    this.stopLoop();
    pushEvent(this.state, { level: "info", message: "Engine stopped." });
    await this.persist();
    return this.snapshot();
  }

  async kill() {
    const coins = [...this.state.positions.map((p) => p.coin)];
    for (const coin of coins) {
      await this.closePosition(coin, "Kill switch — flatten");
    }
    this.state.status = "halted";
    this.state.haltReason = "Kill switch";
    this.stopLoop();
    pushEvent(this.state, { level: "warn", message: "Kill switch: flattened all positions and halted entries." });
    await this.persist();
    return this.snapshot();
  }

  async resetPaper() {
    if (this.state.config.mode === "live") {
      throw new Error("Reset is only available in paper mode.");
    }
    this.stopLoop();
    const config = this.state.config;
    this.state = createInitialState(config);
    this.markets = [];
    pushEvent(this.state, { level: "info", message: "Paper book reset to starting equity." });
    await this.persist();
    return this.snapshot();
  }

  private startLoop() {
    this.stopLoop();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.state.config.tickMs);
  }

  private stopLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.ticking) return this.snapshot();
    this.ticking = true;
    try {
      const { config } = this.state;
      this.markets = await fetchMarkets(this.dataNetwork(), config.coins);
      const marks: Record<string, number> = {};
      for (const m of this.markets) marks[m.coin] = m.midPx || m.markPx;

      this.rollDayIfNeeded();
      markToMarket(this.state.paper, this.state.positions, marks);
      this.recordEquity();

      if (this.state.status === "running") {
        await this.enforceStops(marks);
        if (this.breachedDailyLoss()) {
          this.state.status = "halted";
          this.state.haltReason = `Daily loss limit (${config.strategy.dailyLossLimitPct}%) hit`;
          this.stopLoop();
          pushEvent(this.state, { level: "warn", message: this.state.haltReason });
        } else {
          await this.evaluateEntries();
        }
      }

      this.state.lastTickAt = Date.now();
      this.state.ticks += 1;
      this.state.lastError = null;
      await this.persist();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.lastError = message;
      pushEvent(this.state, { level: "error", message });
      await this.persist();
    } finally {
      this.ticking = false;
    }
    return this.snapshot();
  }

  private dataNetwork() {
    // Paper trades against mainnet prices even if live keys point at testnet.
    return this.state.config.mode === "live" ? liveReadiness().network : this.state.config.network;
  }

  private rollDayIfNeeded() {
    const today = utcDayStart(Date.now());
    if (this.state.paper.dayStartTs !== today) {
      this.state.paper.dayStartTs = today;
      this.state.paper.dayStartEquity = this.state.paper.equity;
      if (this.state.status === "halted" && this.state.haltReason?.startsWith("Daily loss")) {
        this.state.status = "running";
        this.state.haltReason = null;
        this.startLoop();
        pushEvent(this.state, { level: "info", message: "New UTC day — daily loss halt cleared." });
      }
    }
  }

  private breachedDailyLoss(): boolean {
    const { paper, config } = this.state;
    if (paper.dayStartEquity <= 0) return false;
    const dd = ((paper.equity - paper.dayStartEquity) / paper.dayStartEquity) * 100;
    return dd <= -config.strategy.dailyLossLimitPct;
  }

  private recordEquity() {
    const last = this.state.equityCurve.at(-1);
    if (!last || Date.now() - last.ts > 20_000) {
      this.state.equityCurve.push({ ts: Date.now(), equity: this.state.paper.equity });
      this.state.equityCurve = this.state.equityCurve.slice(-500);
    } else {
      last.equity = this.state.paper.equity;
      last.ts = Date.now();
    }
  }

  private async enforceStops(marks: Record<string, number>) {
    for (const pos of [...this.state.positions]) {
      const mark = marks[pos.coin];
      if (!mark) continue;
      if (hitStop(pos, mark)) {
        await this.closePosition(pos.coin, "ATR stop");
      } else if (hitTake(pos, mark)) {
        await this.closePosition(pos.coin, "ATR take-profit");
      }
    }
  }

  private async evaluateEntries() {
    const { config } = this.state;
    const signals: Signal[] = [];
    const lookback = Math.max(config.strategy.slowEma, config.strategy.atrPeriod) + 30;

    for (const coin of config.coins) {
      const candles = await fetchCandles({
        network: this.dataNetwork(),
        coin,
        interval: config.interval,
        count: lookback,
      });
      if (candles.length < lookback - 10) {
        signals.push({
          coin,
          action: "hold",
          reason: "Not enough candle history",
          fastEma: 0,
          slowEma: 0,
          atr: 0,
          close: candles.at(-1)?.c ?? 0,
          barTime: candles.at(-1)?.t ?? 0,
        });
        continue;
      }

      const position = this.state.positions.find((p) => p.coin === coin);
      const signal = evaluateEmaCrossover({
        coin,
        candles,
        position,
        config: config.strategy,
      });
      signals.push(signal);

      const alreadyActed = this.state.lastBarProcessed[coin] === signal.barTime;
      if (alreadyActed) continue;

      if (signal.action === "flat" && position) {
        await this.closePosition(coin, signal.reason);
        this.state.lastBarProcessed[coin] = signal.barTime;
        continue;
      }

      if (signal.action === "long" || signal.action === "short") {
        await this.openPosition(signal);
        this.state.lastBarProcessed[coin] = signal.barTime;
      }
    }

    this.state.lastSignals = signals;
  }

  private async openPosition(signal: Signal) {
    const { config, paper } = this.state;
    if (this.state.status !== "running") return;
    if (this.state.positions.some((p) => p.coin === signal.coin)) return;
    if (this.state.positions.length >= config.strategy.maxPositions) {
      pushEvent(this.state, {
        level: "info",
        coin: signal.coin,
        message: `Skipped ${signal.action} ${signal.coin}: max positions reached`,
      });
      return;
    }
    const until = this.state.cooldownUntil[signal.coin] ?? 0;
    if (Date.now() < until) {
      pushEvent(this.state, {
        level: "info",
        coin: signal.coin,
        message: `Skipped ${signal.coin}: cooldown until ${new Date(until).toISOString()}`,
      });
      return;
    }

    const market = this.markets.find((m) => m.coin === signal.coin);
    const mark = market?.midPx || market?.markPx || signal.close;
    const sized = sizeFromRisk({
      equity: paper.equity,
      price: mark,
      atr: signal.atr,
      config,
    });
    if (sized.size <= 0 || sized.notional < 15) {
      pushEvent(this.state, {
        level: "warn",
        coin: signal.coin,
        message: `Size too small for ${signal.coin} (notional ${sized.notional.toFixed(2)})`,
      });
      return;
    }

    const levels = stopTakePrices(signal.action, mark, signal.atr, config);
    const leverage = Math.min(config.strategy.maxLeverage, market?.maxLeverage ?? config.strategy.maxLeverage);

    if (config.mode === "live") {
      if (!market) throw new Error(`No market metadata for ${signal.coin}`);
      await setLeverage(market.assetIndex, leverage);
      await placeMarketLike({
        assetIndex: market.assetIndex,
        szDecimals: market.szDecimals,
        side: signal.action,
        size: sized.size,
        mark,
      });
    }

    const { fill, position } = paperFill({
      paper,
      positions: this.state.positions,
      coin: signal.coin,
      side: signal.action,
      action: "open",
      reason: signal.reason,
      size: sized.size,
      mark,
      stopPrice: levels.stopPrice,
      takePrice: levels.takePrice,
      leverage,
      atrAtEntry: signal.atr,
      strategy: config.strategy,
      mode: config.mode,
    });
    if (position) this.state.positions.push(position);
    this.recordFill(fill);
    pushEvent(this.state, {
      level: "trade",
      coin: signal.coin,
      message: `Opened ${signal.action.toUpperCase()} ${signal.coin} @ ${fill.price.toFixed(4)} · ${signal.reason}`,
    });
  }

  private async closePosition(coin: string, reason: string) {
    const position = this.state.positions.find((p) => p.coin === coin);
    if (!position) return;
    const market = this.markets.find((m) => m.coin === coin);
    const mark = market?.midPx || market?.markPx || position.markPrice;

    if (this.state.config.mode === "live" && market) {
      await placeMarketLike({
        assetIndex: market.assetIndex,
        szDecimals: market.szDecimals,
        side: position.side === "long" ? "short" : "long",
        size: position.size,
        mark,
        reduceOnly: true,
      });
    }

    const { fill } = paperFill({
      paper: this.state.paper,
      positions: this.state.positions,
      coin,
      side: position.side,
      action: "close",
      reason,
      size: position.size,
      mark,
      leverage: position.leverage,
      strategy: this.state.config.strategy,
      mode: this.state.config.mode,
    });
    this.state.positions = this.state.positions.filter((p) => p.coin !== coin);
    this.recordFill(fill);
    if (reason.includes("stop") || reason.includes("Stop")) {
      this.state.cooldownUntil[coin] = Date.now() + this.state.config.strategy.cooldownMinutes * 60_000;
    }
    pushEvent(this.state, {
      level: fill.pnl >= 0 ? "trade" : "warn",
      coin,
      message: `Closed ${position.side.toUpperCase()} ${coin} · ${reason} · PnL ${fill.pnl >= 0 ? "+" : ""}${fill.pnl.toFixed(2)}`,
    });
  }

  private recordFill(fill: Fill) {
    this.state.fills.unshift(fill);
    this.state.fills = this.state.fills.slice(0, 250);
  }
}

export { DEFAULT_CONFIG };
