import { createInitialState, createPaperAccount, DEFAULT_CONFIG, DEFAULT_STRATEGY } from "./defaults";
import { markToMarket, paperFill } from "./paper";
import { loadState, migrateCoins, saveState } from "./store";
import { evaluatePriceAction } from "../strategy/price-action";
import { sessionStatus } from "../strategy/session";
import {
  hitStop,
  hitTake,
  moveStopToBreakEven,
  priceMovePctFromRoe,
  shouldArmGiveUp,
  shouldGiveUp,
  shouldMoveStopToBreakEven,
  sizeFromMargin,
  stopTakeFromRoe,
} from "../strategy/risk";
import { canTradeLive, liveReadiness, placeMarketLike, setLeverage } from "../hyperliquid/exchange";
import { fetchCandles, fetchMarkets } from "../hyperliquid/info";
import type {
  BotConfig,
  BotEvent,
  BotState,
  Candle,
  ChartLevel,
  Fill,
  LevelKind,
  LevelSetup,
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
    this.state.config.strategy = {
      ...DEFAULT_STRATEGY,
      ...this.state.config.strategy,
      maxPositions: 1,
    };
    this.state.config.coins = migrateCoins(this.state.config.coins);
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
    const session = sessionStatus(Date.now(), this.state.config.strategy);
    return {
      state: this.state,
      markets: this.markets,
      live: liveReadiness(),
      session: {
        inSession: session.inSession,
        weekend: session.weekend,
        dateKey: session.dateKey,
        clock: session.clock,
        label: session.label,
        startLabel: session.startLabel,
        endLabel: session.endLabel,
      },
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
      coins: migrateCoins(patch.coins?.length ? patch.coins : this.state.config.coins),
      strategy: { ...this.state.config.strategy, ...(patch.strategy ?? {}), maxPositions: 1 },
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
    const tickChanged = next.tickMs !== this.state.config.tickMs;
    this.state.config = next;
    this.state.levels = this.state.levels.filter((l) => next.coins.includes(l.coin));
    this.state.setups = this.state.setups.filter((s) => next.coins.includes(s.coin));
    if (tickChanged && this.state.status === "running") this.startLoop();
    await this.persist();
    pushEvent(this.state, { level: "info", message: "Strategy config updated" });
    return this.snapshot();
  }

  async addLevel(input: { coin: string; kind: LevelKind; price: number; note?: string }) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Level price must be a positive number");
    const coin = input.coin.trim().toUpperCase();
    if (!coin) throw new Error("Choose a market");
    const session = sessionStatus(Date.now(), this.state.config.strategy);
    const duplicate = this.state.levels.find(
      (l) => l.coin === coin && l.kind === input.kind && Math.abs(l.price - price) / price < 0.00005,
    );
    if (duplicate) throw new Error("That level is already on the chart");
    const level: ChartLevel = {
      id: eid("lvl"),
      coin,
      kind: input.kind,
      price,
      note: input.note?.trim() ?? "",
      createdAt: Date.now(),
      sessionDate: session.dateKey,
    };
    this.state.levels.push(level);
    this.state.levels.sort((a, b) => a.coin.localeCompare(b.coin) || b.price - a.price);
    const live = this.state.status === "running";
    pushEvent(this.state, {
      level: "info",
      coin,
      message: live
        ? `Charted ${input.kind} ${price} on ${coin}. Engine is running — it will watch this level from this print forward. No restart needed.`
        : `Charted ${input.kind} ${price} on ${coin}. Start the engine when you want it watched.`,
    });
    await this.persist();
    return this.snapshot();
  }

  async removeLevel(id: string) {
    const existing = this.state.levels.find((l) => l.id === id);
    this.state.levels = this.state.levels.filter((l) => l.id !== id);
    this.state.setups = this.state.setups.filter((s) => s.levelId !== id);
    if (existing) {
      pushEvent(this.state, {
        level: "info",
        coin: existing.coin,
        message: `Removed ${existing.kind} ${existing.price} on ${existing.coin}`,
      });
    }
    await this.persist();
    return this.snapshot();
  }

  async clearLevels() {
    this.state.levels = [];
    this.state.setups = [];
    pushEvent(this.state, { level: "info", message: "Cleared all charted levels" });
    await this.persist();
    return this.snapshot();
  }

  async start() {
    if (this.state.config.mode === "live" && !canTradeLive()) {
      throw new Error("Cannot start live trading: missing agent wallet, account address, or live confirmation.");
    }
    this.state.status = "running";
    this.state.haltReason = null;
    this.state.lastError = null;
    const session = sessionStatus(Date.now(), this.state.config.strategy);
    pushEvent(this.state, {
      level: "info",
      message: this.state.config.mode === "paper"
        ? `Paper engine armed. ${session.label}. No orders sent.`
        : `Live engine started on ${liveReadiness().network}. ${session.label}`,
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
    const levels = this.state.levels;
    this.state = createInitialState(config);
    this.state.levels = levels;
    this.markets = [];
    pushEvent(this.state, { level: "info", message: "Paper book reset. Charted levels kept." });
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
        const candlesByCoin = await this.loadCandles();
        await this.managePositions(marks, candlesByCoin);
        await this.maybeFlattenSession();
        if (this.breachedDailyLoss()) {
          this.state.status = "halted";
          this.state.haltReason = `Daily loss limit (${config.strategy.dailyLossLimitPct}%) hit`;
          this.stopLoop();
          pushEvent(this.state, { level: "warn", message: this.state.haltReason });
        } else {
          await this.evaluateEntries(candlesByCoin);
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
    return this.state.config.mode === "live" ? liveReadiness().network : this.state.config.network;
  }

  private rollDayIfNeeded() {
    const session = sessionStatus(Date.now(), this.state.config.strategy);
    if (this.state.paper.dayKey !== session.dateKey) {
      this.state.paper.dayKey = session.dateKey;
      this.state.paper.dayStartTs = Date.now();
      this.state.paper.dayStartEquity = this.state.paper.equity;
      this.state.lastBarProcessed = {};
      this.state.setups = [];
      if (this.state.status === "halted" && this.state.haltReason?.startsWith("Daily loss")) {
        this.state.status = "running";
        this.state.haltReason = null;
        this.startLoop();
        pushEvent(this.state, { level: "info", message: "New New York day — daily loss halt cleared." });
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

  private async maybeFlattenSession() {
    const { config } = this.state;
    if (!config.strategy.flattenAtSessionEnd) return;
    const session = sessionStatus(Date.now(), config.strategy);
    if (session.weekend || session.inSession) return;
    if (session.minutes < config.strategy.sessionEndMinutes) return;
    if (this.state.lastSessionFlattenDate === session.dateKey) return;
    if (this.state.positions.length === 0) {
      this.state.lastSessionFlattenDate = session.dateKey;
      return;
    }
    for (const pos of [...this.state.positions]) {
      await this.closePosition(pos.coin, "New York session close — flatten");
    }
    this.state.lastSessionFlattenDate = session.dateKey;
  }

  private async loadCandles(): Promise<Map<string, Candle[]>> {
    const { config } = this.state;
    const candlesByCoin = new Map<string, Candle[]>();
    for (const coin of config.coins) {
      const candles = await fetchCandles({
        network: this.dataNetwork(),
        coin,
        interval: config.interval,
        count: 120,
      });
      candlesByCoin.set(coin, candles);
    }
    return candlesByCoin;
  }

  private async managePositions(marks: Record<string, number>, candlesByCoin: Map<string, Candle[]>) {
    const { config } = this.state;
    for (const pos of [...this.state.positions]) {
      const mark = marks[pos.coin];
      if (!mark) continue;
      const live = this.state.positions.find((p) => p.coin === pos.coin);
      if (!live) continue;
      const candles = candlesByCoin.get(pos.coin) ?? [];
      const barTimes = candles.map((c) => c.t);
      const lastBarTime = barTimes.at(-1);

      if (hitTake(live, mark)) {
        await this.closePosition(live.coin, "Take-profit — 10% ROE from entry");
        continue;
      }
      if (hitStop(live, mark)) {
        await this.closePosition(
          live.coin,
          live.breakEvenStop ? "Stop — break-even" : "Stop — 5% ROE from entry",
        );
        continue;
      }

      if (shouldMoveStopToBreakEven(live, mark, config.strategy)) {
        moveStopToBreakEven(live);
        pushEvent(this.state, {
          level: "info",
          coin: live.coin,
          message: `Stop to break-even on ${live.coin} after ${config.strategy.breakEvenRoePct}% ROE (${priceMovePctFromRoe(config.strategy.breakEvenRoePct, live.leverage)}% price)`,
        });
      }

      if (shouldArmGiveUp(live, mark, config.strategy) && lastBarTime != null) {
        live.giveUpArmedBarTime = lastBarTime;
        pushEvent(this.state, {
          level: "info",
          coin: live.coin,
          message: `Armed ${config.strategy.giveUpBars}-bar clock on ${live.coin} after ${config.strategy.giveUpRoePct}% ROE. Flatten if the target is not hit.`,
        });
      }

      if (shouldGiveUp(live, barTimes, config.strategy)) {
        await this.closePosition(
          live.coin,
          `Time stop — ${config.strategy.giveUpBars} bars after ${config.strategy.giveUpRoePct}% ROE without target`,
        );
      }
    }
  }

  private async evaluateEntries(candlesByCoin: Map<string, Candle[]>) {
    const { config } = this.state;
    const signals: Signal[] = [];
    const setups: LevelSetup[] = [];
    const candidates: Signal[] = [];

    for (const coin of config.coins) {
      const candles = candlesByCoin.get(coin) ?? [];
      const result = evaluatePriceAction({
        coin,
        candles,
        levels: this.state.levels,
        config: config.strategy,
      });
      setups.push(...result.setups);
      signals.push(result.signal);

      const alreadyActed = this.state.lastBarProcessed[coin] === result.signal.barTime;
      if (alreadyActed) continue;
      if (this.state.positions.some((p) => p.coin === coin)) {
        this.state.lastBarProcessed[coin] = result.signal.barTime;
        continue;
      }
      if (result.signal.action === "long" || (result.signal.action === "short" && config.strategy.allowShort)) {
        candidates.push(result.signal);
      }
    }

    this.state.lastSignals = signals;
    this.state.setups = setups;

    if (this.state.positions.length >= config.strategy.maxPositions) {
      for (const signal of candidates) {
        this.state.lastBarProcessed[signal.coin] = signal.barTime;
      }
      return;
    }

    candidates.sort((a, b) => {
      const aKey = a.brokeAt ?? a.barTime;
      const bKey = b.brokeAt ?? b.barTime;
      if (aKey !== bKey) return aKey - bKey;
      return config.coins.indexOf(a.coin) - config.coins.indexOf(b.coin);
    });
    const winner = candidates[0];
    if (!winner) return;
    await this.openPosition(winner);
    for (const signal of candidates) {
      this.state.lastBarProcessed[signal.coin] = signal.barTime;
    }
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
    const leverage = Math.min(config.strategy.maxLeverage, market?.maxLeverage ?? config.strategy.maxLeverage);
    const sized = sizeFromMargin({
      equity: paper.equity,
      price: mark,
      leverage,
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

    const slip = mark * (config.strategy.slippageBps / 10_000);
    const side = signal.action === "short" ? "short" : "long";
    const entry = side === "long" ? mark + slip : mark - slip;
    const { stopPrice, takePrice } = stopTakeFromRoe(side, entry, leverage, config.strategy);

    if (config.mode === "live") {
      if (!market) throw new Error(`No market metadata for ${signal.coin}`);
      await setLeverage(market.assetIndex, leverage);
      await placeMarketLike({
        assetIndex: market.assetIndex,
        szDecimals: market.szDecimals,
        side: signal.action === "short" ? "short" : "long",
        size: sized.size,
        mark,
      });
    }

    const { fill, position } = paperFill({
      paper,
      positions: this.state.positions,
      coin: signal.coin,
      side: signal.action === "short" ? "short" : "long",
      action: "open",
      reason: signal.reason,
      size: sized.size,
      mark,
      stopPrice,
      takePrice,
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
    if (reason.toLowerCase().includes("stop")) {
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
