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
      <Card className="border-amber-400/30">
        <CardHeader>
          <CardTitle>Slow day · 1:1 target</CardTitle>
          <CardDescription>
            Turns take profit to 0.5% — the same distance as the stop. The 1% take-profit field, break-even at 0.55%,
            and the 0.8% give-up clock are ignored while this is on, because the trade is already out at 0.5%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/8 px-3 py-3">
            <div>
              <Label>1:1 take profit (0.5%)</Label>
              <p className="text-xs text-muted-foreground">
                Off by default. Use this on a slow tape. Same switch is on the Desk.
              </p>
            </div>
            <Switch
              checked={Boolean(s.oneToOneTarget)}
              onCheckedChange={(v) => setS({ oneToOneTarget: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/25">
        <CardHeader>
          <CardTitle>Failed-level exit</CardTitle>
          <CardDescription>
            After a trade is open, a later 5m close back through the charted level flattens it. Longs exit on a close
            below resistance. Shorts exit on a close above support. The 0.5% stop is only the backstop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/8 px-3 py-3">
            <div>
              <Label>Flatten if close fails the level</Label>
              <p className="text-xs text-muted-foreground">On by default. The entry candle itself does not count.</p>
            </div>
            <Switch
              checked={Boolean(s.flattenOnLevelFail)}
              onCheckedChange={(v) => setS({ flattenOnLevelFail: v })}
            />
          </div>
        </CardContent>
      </Card>

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
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm [color-scheme:dark] dark:bg-input/30"
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value as BotConfig["mode"] })}
            >
              <option value="paper">Paper (recommended)</option>
              <option value="live">Live Hyperliquid</option>
            </select>
          </Field>
          <Field label="Market data network">
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm [color-scheme:dark] dark:bg-input/30"
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
            Close through a charted level, then at least a few 5m bars of consolidation (no need to tag the level),
            then either a closed engulfing candle whose close clears the previous wick, or a bullish/bearish close
            beyond the high/low of the breakout plus that consolidation. A close back through the level kills it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Consolidation bars after break" value={s.minConsolidationBars} onChange={(v) => setS({ minConsolidationBars: v })} />
          <Num label="Max 5m bars after break" value={s.maxBarsAfterBreak} onChange={(v) => setS({ maxBarsAfterBreak: v })} />
          <div className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2 sm:col-span-2">
            <div>
              <Label>Also enter on range break</Label>
              <p className="text-xs text-muted-foreground">
                Close beyond the wick of the breakout candle and the consolidation after it, even if that bar does not
                engulf the previous candle
              </p>
            </div>
            <Switch
              checked={s.allowRangeBreakEntry}
              onCheckedChange={(v) => setS({ allowRangeBreakEntry: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk</CardTitle>
          <CardDescription>
            One market at a time, always 10x. Size is 70% of equity as margin. Stop and target are price moves, not
            account ROE: −0.5% stop and +1% target. At 10x that is 5% / 10% ROE; if leverage were 5x those would be
            2.5% / 5% ROE because the price stops do not change. After +0.55% the stop moves to break-even. After +0.8%
            a 5-bar clock starts; if the target is still open, the trade is closed. A 5m close back through the
            charted level flattens the open trade so it does not have to wait for the 0.5% stop.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Num label="Margin % of account" value={s.marginPct} step="1" onChange={(v) => setS({ marginPct: v })} />
          <Field label="Leverage">
            <p className="flex h-8 items-center text-sm">10x on BTC, ETH, SOL, and HYPE. Not editable.</p>
          </Field>
          <Num label="Stop loss (price %)" value={s.stopLossPricePct} step="0.01" onChange={(v) => setS({ stopLossPricePct: v })} />
          <Num label="Take profit (price %)" value={s.takeProfitPricePct} step="0.01" onChange={(v) => setS({ takeProfitPricePct: v })} />
          <Num label="Break-even after (price %)" value={s.breakEvenPricePct} step="0.01" onChange={(v) => setS({ breakEvenPricePct: v })} />
          <Num label="Give-up after (price %)" value={s.giveUpPricePct} step="0.01" onChange={(v) => setS({ giveUpPricePct: v })} />
          <Num label="Give-up wait (5m bars)" value={s.giveUpBars} onChange={(v) => setS({ giveUpBars: v })} />
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
