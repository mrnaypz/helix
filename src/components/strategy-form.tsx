"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BotConfig, PublicBotSnapshot, StrategyConfig } from "@/lib/bot/types";
import { formatClock, parseClock } from "@/lib/strategy/session";

export function StrategyForm({ initial }: { initial: BotConfig }) {
  const [config, setConfig] = useState<BotConfig>(initial);
  const [coins, setCoins] = useState(initial.coins.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
          <CardTitle>Universe</CardTitle>
          <CardDescription>
            5-minute Hyperliquid perps. Signals only fire on a newly closed New York session candle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Coins" hint="Comma-separated Hyperliquid perp names">
            <Input value={coins} onChange={(e) => setCoins(e.target.value)} />
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
          <Field label="Market data network">
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
          <CardTitle>New York session</CardTitle>
          <CardDescription>
            You chart levels in the morning. The bot does not look for entries until this window. Default is the cash
            open through the cash close, America/New_York.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Session start (ET)">
            <Input
              type="time"
              value={formatClock(s.sessionStartMinutes)}
              onChange={(e) => setS({ sessionStartMinutes: parseClock(e.target.value) })}
            />
          </Field>
          <Field label="Session end (ET)">
            <Input
              type="time"
              value={formatClock(s.sessionEndMinutes)}
              onChange={(e) => setS({ sessionEndMinutes: parseClock(e.target.value) })}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2">
            <div>
              <Label>Flatten at the close</Label>
              <p className="text-xs text-muted-foreground">Day-trade: exit everything at session end</p>
            </div>
            <Switch checked={s.flattenAtSessionEnd} onCheckedChange={(v) => setS({ flattenAtSessionEnd: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2">
            <div>
              <Label>Allow shorts</Label>
              <p className="text-xs text-muted-foreground">Support breaks + bearish engulfing</p>
            </div>
            <Switch checked={s.allowShort} onCheckedChange={(v) => setS({ allowShort: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price-action rules</CardTitle>
          <CardDescription>
            Break of a charted level, pullback into that level, then a closed 5m engulfing candle in the breakout
            direction. Stop sits beyond the pullback extreme; target is a reward:risk multiple, or the next level if
            it is closer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Retest zone (bps)" value={s.retestToleranceBps} step="1" onChange={(v) => setS({ retestToleranceBps: v })} />
          <Num label="Retest zone (ATR frac)" value={s.retestAtrFrac} step="0.05" onChange={(v) => setS({ retestAtrFrac: v })} />
          <Num label="Max 5m bars after break" value={s.maxBarsAfterBreak} onChange={(v) => setS({ maxBarsAfterBreak: v })} />
          <Num label="Reward : risk" value={s.rewardRisk} step="0.1" onChange={(v) => setS({ rewardRisk: v })} />
          <Num label="Stop buffer (ATR)" value={s.stopBufferAtr} step="0.05" onChange={(v) => setS({ stopBufferAtr: v })} />
          <Num label="ATR period" value={s.atrPeriod} onChange={(v) => setS({ atrPeriod: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk</CardTitle>
          <CardDescription>
            Size is risk-percent divided by stop distance, then capped by max leverage. Daily loss uses the New York date.
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
