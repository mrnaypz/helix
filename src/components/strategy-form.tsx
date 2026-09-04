"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BotConfig, PublicBotSnapshot, StrategyConfig } from "@/lib/bot/types";

const INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "4h"] as const;

export function StrategyForm() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [coins, setCoins] = useState("BTC, ETH, SOL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/bot")
      .then((r) => r.json())
      .then((snap: PublicBotSnapshot) => {
        setConfig(snap.state.config);
        setCoins(snap.state.config.coins.join(", "));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!config) {
    return <p className="text-sm text-muted-foreground">Loading strategy…</p>;
  }

  const s = config.strategy;
  const setS = (patch: Partial<StrategyConfig>) =>
    setConfig({ ...config, strategy: { ...config.strategy, ...patch } });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const parsedCoins = coins
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "config",
          config: { ...config, coins: parsedCoins.length ? parsedCoins : config.coins },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfig((data as PublicBotSnapshot).state.config);
      setMessage("Saved. The next tick uses these parameters.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Universe and cadence</CardTitle>
          <CardDescription>
            Signals fire only on a newly closed candle. Stops and take-profits are checked every tick against the live mid.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Coins" hint="Comma-separated Hyperliquid perp names">
            <Input value={coins} onChange={(e) => setCoins(e.target.value)} />
          </Field>
          <Field label="Candle interval">
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={config.interval}
              onChange={(e) => setConfig({ ...config, interval: e.target.value as BotConfig["interval"] })}
            >
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tick interval (ms)" hint="How often the desk polls Hyperliquid">
            <Input
              type="number"
              value={config.tickMs}
              onChange={(e) => setConfig({ ...config, tickMs: Number(e.target.value) })}
            />
          </Field>
          <Field label="Starting paper equity">
            <Input
              type="number"
              value={config.startingEquity}
              onChange={(e) => setConfig({ ...config, startingEquity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Execution">
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value as BotConfig["mode"] })}
            >
              <option value="paper">Paper (recommended)</option>
              <option value="live">Live Hyperliquid</option>
            </select>
          </Field>
          <Field label="Market data network" hint="Paper uses this for prices. Live follows HL_NETWORK.">
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={config.network}
              onChange={(e) => setConfig({ ...config, network: e.target.value as BotConfig["network"] })}
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>EMA trend rules</CardTitle>
          <CardDescription>
            Long when the fast EMA crosses above the slow EMA. Short on the opposite cross. Optional trend filter
            requires price to sit on the correct side of the slow EMA.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Fast EMA" value={s.fastEma} onChange={(v) => setS({ fastEma: v })} />
          <Num label="Slow EMA" value={s.slowEma} onChange={(v) => setS({ slowEma: v })} />
          <Num label="ATR period" value={s.atrPeriod} onChange={(v) => setS({ atrPeriod: v })} />
          <Num label="Stop ATR multiple" value={s.atrStopMultiplier} step="0.1" onChange={(v) => setS({ atrStopMultiplier: v })} />
          <Num label="Take ATR multiple" value={s.atrTakeMultiplier} step="0.1" onChange={(v) => setS({ atrTakeMultiplier: v })} />
          <div className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2">
            <div>
              <Label>Trend filter</Label>
              <p className="text-xs text-muted-foreground">Price vs slow EMA</p>
            </div>
            <Switch checked={s.trendFilter} onCheckedChange={(v) => setS({ trendFilter: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2">
            <div>
              <Label>Allow shorts</Label>
              <p className="text-xs text-muted-foreground">Otherwise long-only</p>
            </div>
            <Switch checked={s.allowShort} onCheckedChange={(v) => setS({ allowShort: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk</CardTitle>
          <CardDescription>
            Size is risk-percent / ATR stop distance, then capped by max leverage. A UTC daily loss halt blocks new entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Risk % per trade" value={s.riskPctPerTrade} step="0.1" onChange={(v) => setS({ riskPctPerTrade: v })} />
          <Num label="Max leverage" value={s.maxLeverage} onChange={(v) => setS({ maxLeverage: v })} />
          <Num label="Max positions" value={s.maxPositions} onChange={(v) => setS({ maxPositions: v })} />
          <Num label="Daily loss limit %" value={s.dailyLossLimitPct} step="0.1" onChange={(v) => setS({ dailyLossLimitPct: v })} />
          <Num label="Cooldown after stop (min)" value={s.cooldownMinutes} onChange={(v) => setS({ cooldownMinutes: v })} />
          <Num label="Slippage (bps)" value={s.slippageBps} step="0.1" onChange={(v) => setS({ slippageBps: v })} />
          <Num label="Taker fee (bps)" value={s.takerFeeBps} step="0.1" onChange={(v) => setS({ takerFeeBps: v })} />
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save strategy"}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}
